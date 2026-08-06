import { describe, expect, it } from 'vitest'
import { blankProject, newCharacter } from '@/lib/factory'
import { collectAssetUsage, duplicateCandidateIds } from '@/lib/assetCatalog'
import type { StoredAsset } from '@/lib/db'

describe('assetCatalog', () => {
  it('立ち絵差分と演出を含めて使用箇所を集計する', () => {
    const project = blankProject()
    const character = newCharacter('結衣', 0)
    character.portraits.push({ id: 'p', name: '笑顔', asset: 'asset:smile' })
    project.characters.push(character)
    project.scenes[0].lines.push({ id: 'stage', kind: 'stage', action: 'se', asset: 'asset:bell', charId: '', portraitId: '', position: 'center', transition: 'cut', screenEffect: 'shake', duration: 0 })
    const usage = collectAssetUsage(project)
    expect(usage.get('smile')?.[0]).toContain('笑顔')
    expect(usage.get('bell')?.[0]).toContain('演出')
  })

  it('同じ種類とサイズだけを重複候補にする', () => {
    const make = (id: string, size: number): StoredAsset => ({ id, name: id, type: 'image/png', size, blob: new Blob(), createdAt: 0, tags: [] })
    const duplicates = duplicateCandidateIds([make('a', 10), make('b', 10), make('c', 20)])
    expect([...duplicates].sort()).toEqual(['a', 'b'])
  })
})

