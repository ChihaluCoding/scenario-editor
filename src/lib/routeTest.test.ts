import { describe, expect, it } from 'vitest'
import { nanoid } from 'nanoid'
import { blankProject, newScene, newVariable } from '@/lib/factory'
import { isConditionGroupImpossible, testRoutes } from '@/lib/routeTest'

describe('testRoutes', () => {
  it('選択肢を探索して複数のエンディングと到達率を返す', () => {
    const project = blankProject()
    const good = newScene('GOOD END')
    const bad = newScene('BAD END')
    good.ending = 'good'
    bad.ending = 'bad'
    project.scenes[0].lines = [{
      id: nanoid(), kind: 'choice', prompt: '選ぶ', options: [
        { id: nanoid(), text: '助ける', next: good.id, whenLocked: 'hide', effects: [] },
        { id: nanoid(), text: '帰る', next: bad.id, whenLocked: 'hide', effects: [] },
      ],
    }]
    project.scenes.push(good, bad)

    const result = testRoutes(project)

    expect(result.endings.map((ending) => ending.type).sort()).toEqual(['bad', 'good'])
    expect(result.sceneCoverage).toBe(1)
    expect(result.truncated).toBe(false)
  })

  it('同じ状態へ戻る循環を検出して終了する', () => {
    const project = blankProject()
    project.scenes[0].lines = [{ id: nanoid(), kind: 'jump', next: project.scenes[0].id }]
    const result = testRoutes(project)
    expect(result.issues.some((issue) => issue.kind === 'loop')).toBe(true)
    expect(result.truncated).toBe(false)
  })
})

describe('isConditionGroupImpossible', () => {
  it('同じ数値に対する矛盾条件を検出する', () => {
    const variable = newVariable('好感度', 'number')
    const impossible = isConditionGroupImpossible({ mode: 'all', items: [
      { id: nanoid(), varId: variable.id, op: '>', value: 10 },
      { id: nanoid(), varId: variable.id, op: '<', value: 5 },
    ] }, [variable])
    expect(impossible).toBe(true)
  })
})

