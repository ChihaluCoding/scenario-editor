import { projectFileSchema, type Project } from '@/types'
import { assetIdOf, getAsset, isAssetRef, putAssetBlob } from './db'
import { blobToDataUrl, dataUrlToBlob } from './assets'
import { describeCondition, describeEffect } from './vars'
import { generateGodotJSON, generateRenPy, generateTyranoScript, generateUnityCSharp, generateVoiceCSV } from './exports/engineAdapters'

const safeName = (s: string) => (s.trim() || 'scenario').replace(/[\\/:*?"<>|]/g, '_')

export function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** プロジェクト内で使われているアセット参照を集める */
export function collectAssetRefs(project: Project): string[] {
  const refs = new Set<string>()
  for (const c of project.characters) if (isAssetRef(c.avatar)) refs.add(c.avatar)
  for (const c of project.characters) for (const portrait of c.portraits) if (isAssetRef(portrait.asset)) refs.add(portrait.asset)
  for (const s of project.scenes) {
    if (isAssetRef(s.bg)) refs.add(s.bg)
    if (isAssetRef(s.bgm)) refs.add(s.bgm)
    for (const line of s.lines) {
      if (line.kind === 'say' && isAssetRef(line.voice)) refs.add(line.voice)
      if (line.kind === 'stage' && isAssetRef(line.asset)) refs.add(line.asset)
    }
  }
  for (const template of project.templates) {
    for (const line of template.lines) {
      if (line.kind === 'say' && isAssetRef(line.voice)) refs.add(line.voice)
      if (line.kind === 'stage' && isAssetRef(line.asset)) refs.add(line.asset)
    }
  }
  return [...refs]
}

/**
 * プロジェクト JSON。`embedAssets` を付けると画像・音声を data URL で同梱するので
 * 1ファイルで別の端末へ持ち出せる（そのぶんファイルは大きくなる）。
 */
export async function exportJSON(project: Project, embedAssets = true) {
  const payload: Record<string, unknown> = { ...project }

  if (embedAssets) {
    const assets = []
    for (const ref of collectAssetRefs(project)) {
      const asset = await getAsset(assetIdOf(ref))
      if (!asset) continue
      assets.push({ id: asset.id, name: asset.name, type: asset.type, tags: asset.tags ?? [], dataUrl: await blobToDataUrl(asset.blob) })
    }
    if (assets.length) payload.assets = assets
  }

  download(JSON.stringify(payload, null, 2), `${safeName(project.title)}.json`, 'application/json')
}

/** 校正・共有用のプレーンな台本 */
export function exportScript(project: Project) {
  const nameOf = (id: string) => project.characters.find((c) => c.id === id)?.name ?? '???'
  const titleOf = (id: string) => project.scenes.find((s) => s.id === id)?.title
  const condSuffix = (cond: Parameters<typeof describeCondition>[0]) => {
    const text = describeCondition(cond, project)
    return text ? `  〈${text}〉` : ''
  }

  const out: string[] = [`# ${project.title}`]
  if (project.author) out.push(`著者: ${project.author}`)
  if (project.variables.length) {
    out.push('', '## 変数', ...project.variables.map((v) => `- ${v.name}（${v.type}）初期値: ${String(v.initial)}`))
  }
  out.push('')

  for (const scene of project.scenes) {
    const meta = [scene.chapter, scene.status, scene.ending ? `${scene.ending.toUpperCase()} END` : '', ...scene.tags.map((tag) => `#${tag}`)].filter(Boolean).join(' / ')
    out.push(`## ${scene.title}${scene.id === project.startSceneId ? '  【開始】' : ''}`)
    if (meta) out.push(`_${meta}_`)
    if (scene.summary) out.push(`> ${scene.summary}`)
    if (scene.bg) out.push(`(背景: ${scene.bg})`)
    if (scene.bgm) out.push(`(BGM: ${scene.bgm})`)
    out.push('')

    for (const line of scene.lines) {
      const c = condSuffix(line.cond)
      switch (line.kind) {
        case 'say':
          out.push(`${nameOf(line.charId)}「${line.text}」${c}`)
          break
        case 'narration':
          out.push(`　${line.text}${c}`)
          break
        case 'note':
          out.push(`<!-- ${line.text} -->`)
          break
        case 'jump':
          out.push(`=> ${titleOf(line.next) ?? '（終了）'}${c}`)
          break
        case 'set':
          out.push(`[${line.effects.map((e) => describeEffect(e, project)).join(', ')}]${c}`)
          break
        case 'stage':
          out.push(`[演出: ${line.action}${line.asset ? ` / ${line.asset}` : ''}]${c}`)
          break
        case 'choice':
          if (line.prompt) out.push(`【${line.prompt}】${c}`)
          for (const o of line.options) {
            const effects = o.effects.length ? ` {${o.effects.map((e) => describeEffect(e, project)).join(', ')}}` : ''
            out.push(`  ◆ ${o.text} => ${titleOf(o.next) ?? '（そのまま続行）'}${condSuffix(o.cond)}${effects}`)
          }
          break
      }
    }
    out.push('')
  }
  download(out.join('\n'), `${safeName(project.title)}.md`, 'text/markdown')
}

/** ゲームエンジンに取り込みやすいフラットなコマンド列 */
export function exportEngineJSON(project: Project) {
  const data = {
    title: project.title,
    start: project.startSceneId,
    variables: project.variables.map((v) => ({ id: v.id, name: v.name, type: v.type, initial: v.initial })),
    characters: Object.fromEntries(project.characters.map((c) => [c.id, { name: c.name, color: c.color, avatar: c.avatar, portraits: c.portraits }])),
    scenes: project.scenes.map((s, i) => ({
      id: s.id,
      title: s.title,
      chapter: s.chapter,
      tags: s.tags,
      status: s.status,
      ending: s.ending,
      bg: s.bg || null,
      bgm: s.bgm || null,
      next: project.scenes[i + 1]?.id ?? null,
      commands: s.lines
        .filter((l) => l.kind !== 'note')
        .map((l) => {
          const when = l.cond?.items.length ? { when: l.cond } : {}
          switch (l.kind) {
            case 'say':
              return { op: 'say', speaker: l.charId || null, text: l.text, voice: l.voice || null, ...when }
            case 'narration':
              return { op: 'text', text: l.text, ...when }
            case 'jump':
              return { op: 'jump', target: l.next || null, ...when }
            case 'set':
              return { op: 'set', effects: l.effects, ...when }
            case 'choice':
              return {
                op: 'choice',
                prompt: l.prompt,
                options: l.options.map((o) => ({
                  text: o.text,
                  target: o.next || null,
                  effects: o.effects,
                  whenLocked: o.whenLocked,
                  ...(o.cond?.items.length ? { when: o.cond } : {}),
                })),
                ...when,
              }
            case 'stage':
              return { op: 'stage', action: l.action, asset: l.asset || null, character: l.charId || null, portrait: l.portraitId || null, position: l.position, transition: l.transition, screenEffect: l.screenEffect, duration: l.duration, ...when }
          }
        }),
    })),
  }
  download(JSON.stringify(data, null, 2), `${safeName(project.title)}.engine.json`, 'application/json')
}

export const exportRenPy = (project: Project) => download(generateRenPy(project), `${safeName(project.title)}.rpy`, 'text/plain')
export const exportTyranoScript = (project: Project) => download(generateTyranoScript(project), `${safeName(project.title)}.ks`, 'text/plain')
export const exportGodotJSON = (project: Project) => download(generateGodotJSON(project), `${safeName(project.title)}.godot.json`, 'application/json')
export const exportUnityCSharp = (project: Project) => download(generateUnityCSharp(project), `${safeName(project.title)}.cs`, 'text/plain')
export const exportVoiceCSV = (project: Project) => download(generateVoiceCSV(project), `${safeName(project.title)}.voice.csv`, 'text/csv')

/** 読み込み。同梱アセットがあれば IndexedDB へ復元する。 */
export async function importJSON(file: File): Promise<Project> {
  const parsed = projectFileSchema.safeParse(JSON.parse(await file.text()))
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? '形式が不正です')

  const { assets, ...project } = parsed.data
  for (const asset of assets ?? []) {
    await putAssetBlob(asset.id, asset.name, asset.type, await dataUrlToBlob(asset.dataUrl), asset.tags ?? [])
  }
  return project
}
