import type { ConditionGroup, EndingType, Project, Variable } from '@/types'
import { applyEffects, evalConditions, initialVars, type VarState } from '@/lib/vars'

export interface EndingRoute {
  sceneId: string
  title: string
  type: EndingType
  choices: string[]
}

export interface RouteTestIssue {
  kind: 'dead-end' | 'loop' | 'impossible' | 'limit'
  sceneId: string
  lineId?: string
  message: string
}

export interface RouteTestResult {
  processedStates: number
  reachedSceneIds: string[]
  reachedLineIds: string[]
  endings: EndingRoute[]
  issues: RouteTestIssue[]
  sceneCoverage: number
  lineCoverage: number
  truncated: boolean
}

interface RouteState {
  sceneId: string
  index: number
  vars: VarState
  choices: string[]
  trail: string[]
}

const stateKey = (state: Pick<RouteState, 'sceneId' | 'index' | 'vars'>, project: Project) =>
  JSON.stringify([state.sceneId, state.index, project.variables.map((variable) => state.vars[variable.id])])

function candidateValues(variable: Variable, group: ConditionGroup) {
  if (variable.type === 'boolean') return [false, true]
  if (variable.type === 'string') {
    const values = group.items.filter((item) => item.varId === variable.id).map((item) => String(item.value))
    return [...new Set([String(variable.initial), ...values, '__その他__'])]
  }
  const values = group.items
    .filter((item) => item.varId === variable.id)
    .map((item) => Number(item.value))
    .filter(Number.isFinite)
  const sorted = [...new Set([Number(variable.initial), ...values])].sort((a, b) => a - b)
  const expanded = sorted.flatMap((value, index) => {
    const next = sorted[index + 1]
    return next == null ? [value - 1, value, value + 1] : [value - 1, value, (value + next) / 2]
  })
  return [...new Set(expanded)]
}

/** AND条件を変数単位で調べ、同時成立する候補値がない条件を検出する。 */
export function isConditionGroupImpossible(group: ConditionGroup | undefined, variables: Variable[]): boolean {
  if (!group?.items.length || group.mode !== 'all') return false
  const ids = [...new Set(group.items.map((item) => item.varId))]
  return ids.some((id) => {
    const variable = variables.find((item) => item.id === id)
    if (!variable) return true
    const subset = { mode: 'all' as const, items: group.items.filter((item) => item.varId === id) }
    return !candidateValues(variable, group).some((value) =>
      evalConditions(subset, { [id]: value }, [variable]),
    )
  })
}

/** 選択肢と変数状態を幅優先で探索し、到達率と制作上の問題を返す。 */
export function testRoutes(project: Project, maxStates = 2500): RouteTestResult {
  const reachedScenes = new Set<string>()
  const reachedLines = new Set<string>()
  const endings: EndingRoute[] = []
  const issues: RouteTestIssue[] = []
  const issueKeys = new Set<string>()
  const visited = new Set<string>()
  const addIssue = (issue: RouteTestIssue) => {
    const key = `${issue.kind}:${issue.sceneId}:${issue.lineId ?? ''}:${issue.message}`
    if (!issueKeys.has(key)) {
      issueKeys.add(key)
      issues.push(issue)
    }
  }

  // 静的に判定できる矛盾は、未到達の行についても報告する。
  for (const scene of project.scenes) {
    for (const line of scene.lines) {
      if (isConditionGroupImpossible(line.cond, project.variables)) {
        addIssue({ kind: 'impossible', sceneId: scene.id, lineId: line.id, message: '行の条件が同時に成立しません' })
      }
      if (line.kind === 'choice') {
        for (const option of line.options) {
          if (isConditionGroupImpossible(option.cond, project.variables)) {
            addIssue({ kind: 'impossible', sceneId: scene.id, lineId: line.id, message: `選択肢「${option.text || '無題'}」の条件が成立しません` })
          }
        }
      }
    }
  }

  const initial: RouteState = {
    sceneId: project.startSceneId,
    index: 0,
    vars: initialVars(project.variables),
    choices: [],
    trail: [],
  }
  initial.trail = [stateKey(initial, project)]
  const queue: RouteState[] = [initial]
  let processedStates = 0
  let truncated = false

  const enqueue = (next: Omit<RouteState, 'trail'>, from: RouteState, lineId?: string) => {
    const key = stateKey(next, project)
    if (from.trail.includes(key)) {
      addIssue({ kind: 'loop', sceneId: from.sceneId, lineId, message: '同じ状態へ戻る循環ルートがあります' })
      return
    }
    queue.push({ ...next, trail: [...from.trail, key] })
  }

  while (queue.length > 0) {
    if (processedStates >= maxStates) {
      truncated = true
      addIssue({ kind: 'limit', sceneId: project.startSceneId, message: `状態数が${maxStates}件を超えたため探索を打ち切りました` })
      break
    }
    const state = queue.shift()!
    const key = stateKey(state, project)
    if (visited.has(key)) continue
    visited.add(key)
    processedStates += 1

    const scene = project.scenes.find((item) => item.id === state.sceneId)
    if (!scene) {
      addIssue({ kind: 'dead-end', sceneId: state.sceneId, message: '遷移先のシーンが見つかりません' })
      continue
    }
    reachedScenes.add(scene.id)

    if (state.index >= scene.lines.length) {
      if (scene.ending) {
        if (!endings.some((ending) => ending.sceneId === scene.id)) {
          endings.push({ sceneId: scene.id, title: scene.title, type: scene.ending, choices: state.choices })
        }
        continue
      }
      const nextScene = project.scenes[project.scenes.indexOf(scene) + 1]
      if (nextScene) enqueue({ ...state, sceneId: nextScene.id, index: 0 }, state)
      continue
    }

    const line = scene.lines[state.index]
    if (!evalConditions(line.cond, state.vars, project.variables)) {
      enqueue({ ...state, index: state.index + 1 }, state, line.id)
      continue
    }
    reachedLines.add(line.id)

    if (line.kind === 'jump') {
      if (!line.next) {
        addIssue({ kind: 'dead-end', sceneId: scene.id, lineId: line.id, message: 'ジャンプ先がなく、ここで進行が止まります' })
      } else {
        enqueue({ ...state, sceneId: line.next, index: 0 }, state, line.id)
      }
      continue
    }
    if (line.kind === 'set') {
      enqueue({ ...state, index: state.index + 1, vars: applyEffects(line.effects, state.vars, project.variables) }, state, line.id)
      continue
    }
    if (line.kind === 'choice') {
      const available = line.options.filter((option) => evalConditions(option.cond, state.vars, project.variables))
      if (available.length === 0) {
        addIssue({ kind: 'dead-end', sceneId: scene.id, lineId: line.id, message: '選べる選択肢がなく、進行できません' })
      }
      for (const option of available) {
        const vars = applyEffects(option.effects, state.vars, project.variables)
        const choices = [...state.choices, option.text || '(無題)']
        enqueue(
          option.next
            ? { sceneId: option.next, index: 0, vars, choices }
            : { ...state, index: state.index + 1, vars, choices },
          state,
          line.id,
        )
      }
      continue
    }
    enqueue({ ...state, index: state.index + 1 }, state, line.id)
  }

  const totalLines = project.scenes.reduce((total, scene) => total + scene.lines.length, 0)
  return {
    processedStates,
    reachedSceneIds: [...reachedScenes],
    reachedLineIds: [...reachedLines],
    endings,
    issues,
    sceneCoverage: project.scenes.length ? reachedScenes.size / project.scenes.length : 1,
    lineCoverage: totalLines ? reachedLines.size / totalLines : 1,
    truncated,
  }
}

