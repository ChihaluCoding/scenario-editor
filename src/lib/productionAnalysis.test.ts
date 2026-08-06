import { describe, expect, it } from 'vitest'
import { nanoid } from 'nanoid'
import { blankProject, newCharacter } from '@/lib/factory'
import { characterProductionStats, productionProgress } from '@/lib/productionAnalysis'

describe('productionAnalysis', () => {
  it('キャラクターのセリフ量と長文を集計する', () => {
    const project = blankProject()
    const character = newCharacter('結衣', 0)
    project.characters.push(character)
    project.scenes[0].lines = [
      { id: nanoid(), kind: 'say', charId: character.id, text: '短いセリフ', voice: '' },
      { id: nanoid(), kind: 'say', charId: character.id, text: '長'.repeat(121), voice: '' },
    ]
    const stats = characterProductionStats(project)[0]
    expect(stats.lines).toBe(2)
    expect(stats.longLines).toBe(1)
    expect(stats.scenes).toBe(1)
  })

  it('シーンがない場合を含め、完成率を安全に計算する', () => {
    const project = blankProject()
    project.scenes[0].status = 'done'
    expect(productionProgress(project).ratio).toBe(1)
  })
})
