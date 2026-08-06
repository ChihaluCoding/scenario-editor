import { describe, expect, it } from 'vitest'
import { buildEdges, findIssues, reachableScenes } from './analysis'
import { blankProject, newScene } from './factory'
import type { Project, Scene } from '@/types'

function project(scenes: Scene[]): Project {
  return { ...blankProject(), scenes, startSceneId: scenes[0].id }
}

describe('buildEdges', () => {
  it('明示的な遷移がないシーンは次のシーンへ落ちる', () => {
    const a = newScene('A')
    const b = newScene('B')
    const edges = buildEdges(project([a, b]))
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ from: a.id, to: b.id, kind: 'fallthrough' })
  })

  it('無条件ジャンプがあると次シーンへは落ちない', () => {
    const a = newScene('A')
    const b = newScene('B')
    const c = newScene('C')
    a.lines = [{ id: 'l1', kind: 'jump', next: c.id }]
    const edges = buildEdges(project([a, b, c]))
    expect(edges.filter((e) => e.from === a.id)).toEqual([
      expect.objectContaining({ to: c.id, kind: 'jump', conditional: false }),
    ])
  })

  it('条件付きジャンプは fallthrough も残す', () => {
    const a = newScene('A')
    const b = newScene('B')
    const c = newScene('C')
    a.lines = [
      {
        id: 'l1',
        kind: 'jump',
        next: c.id,
        cond: { mode: 'all', items: [{ id: 'x', varId: 'v', op: '>=', value: 1 }] },
      },
    ]
    const kinds = buildEdges(project([a, b, c]))
      .filter((e) => e.from === a.id)
      .map((e) => e.kind)
    expect(kinds).toEqual(['jump', 'fallthrough'])
  })

  it('選択肢の各分岐がエッジになる', () => {
    const a = newScene('A')
    const b = newScene('B')
    const c = newScene('C')
    a.lines = [
      {
        id: 'l1',
        kind: 'choice',
        prompt: '',
        options: [
          { id: 'o1', text: '左', next: b.id, whenLocked: 'hide', effects: [] },
          { id: 'o2', text: '右', next: c.id, whenLocked: 'hide', effects: [] },
        ],
      },
    ]
    const fromA = buildEdges(project([a, b, c])).filter((e) => e.from === a.id)
    expect(fromA.map((e) => e.label)).toEqual(['左', '右'])
    expect(fromA.every((e) => e.kind === 'choice')).toBe(true)
  })
})

describe('reachableScenes', () => {
  it('開始シーンから辿れないシーンを検出する', () => {
    const a = newScene('A')
    const orphan = newScene('孤立')
    const b = newScene('B')
    a.lines = [{ id: 'l1', kind: 'jump', next: b.id }]
    const reachable = reachableScenes(project([a, orphan, b]))
    expect(reachable.has(b.id)).toBe(true)
    expect(reachable.has(orphan.id)).toBe(false)
  })

  it('循環していても停止する', () => {
    const a = newScene('A')
    const b = newScene('B')
    a.lines = [{ id: 'l1', kind: 'jump', next: b.id }]
    b.lines = [{ id: 'l2', kind: 'jump', next: a.id }]
    expect(reachableScenes(project([a, b])).size).toBe(2)
  })
})

describe('findIssues', () => {
  it('ジャンプ先未設定をエラーにする', () => {
    const a = newScene('A')
    a.lines = [{ id: 'l1', kind: 'jump', next: '' }]
    expect(findIssues(project([a]))).toContainEqual(
      expect.objectContaining({ severity: 'error', message: 'ジャンプ先が未設定です' }),
    )
  })

  it('全選択肢が条件付きだと詰む可能性を警告する', () => {
    const a = newScene('A')
    const cond = { mode: 'all' as const, items: [{ id: 'c', varId: 'v', op: '>=' as const, value: 1 }] }
    a.lines = [
      {
        id: 'l1',
        kind: 'choice',
        prompt: '',
        options: [
          { id: 'o1', text: 'A', next: a.id, cond, whenLocked: 'hide', effects: [] },
          { id: 'o2', text: 'B', next: a.id, cond, whenLocked: 'hide', effects: [] },
        ],
      },
    ]
    const messages = findIssues(project([a])).map((i) => i.message)
    expect(messages).toContain('すべての選択肢に条件が付いており、全滅する可能性があります')
  })

  it('問題のないシナリオでは到達性・ジャンプの指摘が出ない', () => {
    const a = newScene('A')
    const b = newScene('B')
    a.lines = [{ id: 'l1', kind: 'narration', text: 'こんにちは' }]
    b.lines = [{ id: 'l2', kind: 'narration', text: 'さようなら' }]
    const messages = findIssues(project([a, b])).map((i) => i.message)
    expect(messages).toEqual([])
  })
})
