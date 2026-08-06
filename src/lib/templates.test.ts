import { describe, expect, it } from 'vitest'
import { nanoid } from 'nanoid'
import { cloneTemplateLines } from '@/lib/templates'
import type { Line } from '@/types'

describe('cloneTemplateLines', () => {
  it('行と入れ子要素を再採番して内容を複製する', () => {
    const source: Line[] = [{
      id: 'line',
      kind: 'choice',
      prompt: '選ぶ',
      options: [{ id: 'option', text: '進む', next: '', whenLocked: 'hide', effects: [{ id: 'effect', varId: 'v', op: 'add', value: 1 }] }],
      cond: { mode: 'all', items: [{ id: 'condition', varId: 'v', op: '>=', value: 1 }] },
    }]

    const cloned = cloneTemplateLines(source)

    expect(cloned).toHaveLength(1)
    expect(cloned[0].id).not.toBe(source[0].id)
    expect(cloned[0].cond?.items[0].id).not.toBe('condition')
    expect(cloned[0].kind === 'choice' && cloned[0].options[0].id).not.toBe('option')
    expect(cloned[0].kind === 'choice' && cloned[0].options[0].effects[0].id).not.toBe('effect')
    expect(source[0].id).toBe('line')
  })

  it('空のテンプレートは空のまま複製する', () => {
    expect(cloneTemplateLines([])).toEqual([])
    expect(nanoid()).toBeTruthy()
  })
})
