import type { Line, Project, Scene } from '@/types'

export interface Edge {
  from: string
  to: string
  label: string
  kind: 'choice' | 'jump' | 'fallthrough'
  /** 条件付きの遷移かどうか（フロー図で破線にする） */
  conditional: boolean
}

export interface Issue {
  sceneId: string
  severity: 'error' | 'warn'
  message: string
}

export const visibleText = (line: Line) =>
  line.kind === 'say' || line.kind === 'narration' ? line.text : ''

export const sceneCharCount = (scene: Scene) =>
  scene.lines.reduce((n, l) => n + visibleText(l).length, 0)

const hasCond = (line: { cond?: { items: unknown[] } }) => (line.cond?.items.length ?? 0) > 0

/**
 * シーン間の遷移を洗い出す。無条件の jump / choice が無いシーンは
 * 配列上の次のシーンへ落ちる（fallthrough）ものとして扱う。
 */
export function buildEdges(project: Project): Edge[] {
  const edges: Edge[] = []
  project.scenes.forEach((scene, i) => {
    /** 必ずこのシーンで進行先が決まる＝次シーンへ落ちない */
    let terminal = false

    for (const line of scene.lines) {
      if (line.kind === 'jump' && line.next) {
        edges.push({ from: scene.id, to: line.next, label: '', kind: 'jump', conditional: hasCond(line) })
        if (!hasCond(line)) terminal = true
      }
      if (line.kind === 'choice') {
        const optional = hasCond(line)
        if (!optional) terminal = true
        for (const opt of line.options) {
          if (opt.next) {
            edges.push({
              from: scene.id,
              to: opt.next,
              label: opt.text || '(無題)',
              kind: 'choice',
              conditional: optional || hasCond(opt),
            })
          }
        }
      }
    }

    const nextScene = project.scenes[i + 1]
    if (!terminal && nextScene) {
      edges.push({ from: scene.id, to: nextScene.id, label: '', kind: 'fallthrough', conditional: false })
    }
  })
  return edges
}

/** 開始シーンから到達できるシーン ID */
export function reachableScenes(project: Project, edges = buildEdges(project)): Set<string> {
  const adj = new Map<string, string[]>()
  for (const e of edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to])
  const seen = new Set<string>()
  const stack = [project.startSceneId]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const to of adj.get(id) ?? []) stack.push(to)
  }
  return seen
}

/** 執筆中に気づきたい問題を洗い出す */
export function findIssues(project: Project): Issue[] {
  const issues: Issue[] = []
  const edges = buildEdges(project)
  const reachable = reachableScenes(project, edges)
  const varIds = new Set(project.variables.map((v) => v.id))
  const add = (sceneId: string, severity: Issue['severity'], message: string) =>
    issues.push({ sceneId, severity, message })

  for (const scene of project.scenes) {
    if (scene.id !== project.startSceneId && !reachable.has(scene.id)) {
      add(scene.id, 'warn', 'どこからも到達できません')
    }
    if (scene.lines.length === 0) add(scene.id, 'warn', '空のシーンです')

    for (const line of scene.lines) {
      for (const c of line.cond?.items ?? []) {
        if (!varIds.has(c.varId)) add(scene.id, 'error', '削除された変数を参照する条件があります')
      }

      switch (line.kind) {
        case 'say':
          if (!line.charId) add(scene.id, 'warn', 'セリフに話者が設定されていません')
          if (!line.text.trim()) add(scene.id, 'warn', '空のセリフがあります')
          break
        case 'jump':
          if (!line.next) add(scene.id, 'error', 'ジャンプ先が未設定です')
          break
        case 'set':
          if (line.effects.length === 0) add(scene.id, 'warn', '空の変数操作があります')
          for (const e of line.effects) {
            if (!varIds.has(e.varId)) add(scene.id, 'error', '削除された変数を操作しようとしています')
          }
          break
        case 'stage':
          if ((line.action === 'background' || line.action === 'se') && !line.asset) {
            add(scene.id, 'warn', `演出「${line.action === 'background' ? '背景変更' : '効果音'}」に素材が設定されていません`)
          }
          if (line.action === 'character' && !line.charId) add(scene.id, 'error', 'キャラクター表示の対象が未設定です')
          if (line.action === 'wait' && line.duration <= 0) add(scene.id, 'warn', '待機時間が0msです')
          break
        case 'choice': {
          if (line.options.length < 2) add(scene.id, 'warn', '選択肢が1つしかありません')
          const alwaysAvailable = line.options.filter((o) => (o.cond?.items.length ?? 0) === 0)
          if (line.options.length > 0 && alwaysAvailable.length === 0) {
            add(scene.id, 'error', 'すべての選択肢に条件が付いており、全滅する可能性があります')
          }
          for (const opt of line.options) {
            if (!opt.text.trim()) add(scene.id, 'error', 'テキストが空の選択肢があります')
            if (!opt.next) add(scene.id, 'warn', `選択肢「${opt.text || '無題'}」の遷移先が未設定です`)
            for (const c of opt.cond?.items ?? []) {
              if (!varIds.has(c.varId)) add(scene.id, 'error', '削除された変数を参照する選択肢条件があります')
            }
          }
          break
        }
      }
    }
  }
  return issues
}

export function projectStats(project: Project) {
  const lines = project.scenes.reduce((n, s) => n + s.lines.length, 0)
  const chars = project.scenes.reduce((n, s) => n + sceneCharCount(s), 0)
  const branches = project.scenes.reduce((n, s) => n + s.lines.filter((l) => l.kind === 'choice').length, 0)
  return {
    scenes: project.scenes.length,
    lines,
    chars,
    branches,
    characters: project.characters.length,
    variables: project.variables.length,
    /** 1分400字換算のおおよその読了時間 */
    minutes: Math.max(1, Math.round(chars / 400)),
  }
}
