import type { Project } from '@/types'
import type { StoredAsset } from '@/lib/db'

const assetId = (reference: string) => reference.startsWith('asset:') ? reference.slice(6) : ''

export type AssetKind = 'image' | 'audio' | 'other'

export function assetKind(type: string): AssetKind {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('audio/')) return 'audio'
  return 'other'
}

/** プロジェクト内の各アセットが使われている場所を、人が読める名称で集計する。 */
export function collectAssetUsage(project: Project): Map<string, string[]> {
  const usage = new Map<string, string[]>()
  const add = (reference: string, location: string) => {
    const id = assetId(reference)
    if (!id) return
    usage.set(id, [...(usage.get(id) ?? []), location])
  }

  for (const character of project.characters) {
    add(character.avatar, `${character.name} / 通常立ち絵`)
    for (const portrait of character.portraits ?? []) add(portrait.asset, `${character.name} / ${portrait.name}`)
  }
  for (const scene of project.scenes) {
    add(scene.bg, `${scene.title} / 背景`)
    add(scene.bgm, `${scene.title} / BGM`)
    for (const line of scene.lines) {
      if (line.kind === 'say') add(line.voice, `${scene.title} / ボイス`)
      if (line.kind === 'stage') add(line.asset, `${scene.title} / 演出`)
    }
  }
  for (const template of project.templates ?? []) {
    for (const line of template.lines) {
      if (line.kind === 'say') add(line.voice, `テンプレート「${template.name}」/ ボイス`)
      if (line.kind === 'stage') add(line.asset, `テンプレート「${template.name}」/ 演出`)
    }
  }
  return usage
}

/** 内容を読み込まず、種類とサイズが同じファイルを重複候補として返す。 */
export function duplicateCandidateIds(assets: StoredAsset[]): Set<string> {
  const groups = new Map<string, StoredAsset[]>()
  for (const asset of assets) {
    const key = `${asset.type}:${asset.size}`
    groups.set(key, [...(groups.get(key) ?? []), asset])
  }
  return new Set([...groups.values()].filter((group) => group.length > 1).flatMap((group) => group.map((asset) => asset.id)))
}
