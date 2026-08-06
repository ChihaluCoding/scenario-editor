import { describe, expect, it } from 'vitest'
import { applyEffects, coerce, evalConditions, initialVars } from './vars'
import type { Condition, Effect, Variable } from '@/types'

const num: Variable = { id: 'v1', name: '好感度', type: 'number', initial: 0, note: '' }
const flag: Variable = { id: 'v2', name: 'フラグ', type: 'boolean', initial: false, note: '' }
const str: Variable = { id: 'v3', name: '名前', type: 'string', initial: '', note: '' }
const variables = [num, flag, str]

const cond = (varId: string, op: Condition['op'], value: Condition['value']): Condition => ({
  id: 'c',
  varId,
  op,
  value,
})
const effect = (varId: string, op: Effect['op'], value: Effect['value']): Effect => ({ id: 'e', varId, op, value })

describe('coerce', () => {
  it('文字列入力を宣言型に合わせる', () => {
    expect(coerce('number', '12')).toBe(12)
    expect(coerce('number', 'abc')).toBe(0)
    expect(coerce('boolean', 'true')).toBe(true)
    expect(coerce('string', 5)).toBe('5')
  })
})

describe('initialVars', () => {
  it('宣言された初期値で状態を作る', () => {
    expect(initialVars(variables)).toEqual({ v1: 0, v2: false, v3: '' })
  })
})

describe('evalConditions', () => {
  it('条件なしは常に真', () => {
    expect(evalConditions(undefined, {}, variables)).toBe(true)
    expect(evalConditions({ mode: 'all', items: [] }, {}, variables)).toBe(true)
  })

  it('数値比較', () => {
    const vars = { v1: 3 }
    expect(evalConditions({ mode: 'all', items: [cond('v1', '>=', 3)] }, vars, variables)).toBe(true)
    expect(evalConditions({ mode: 'all', items: [cond('v1', '>', 3)] }, vars, variables)).toBe(false)
  })

  it('all はすべて、any はいずれかを満たす必要がある', () => {
    const vars = { v1: 5, v2: false }
    const items = [cond('v1', '>=', 3), cond('v2', '==', true)]
    expect(evalConditions({ mode: 'all', items }, vars, variables)).toBe(false)
    expect(evalConditions({ mode: 'any', items }, vars, variables)).toBe(true)
  })

  it('削除された変数を参照する条件は成立しない', () => {
    expect(evalConditions({ mode: 'all', items: [cond('gone', '==', 1)] }, {}, variables)).toBe(false)
  })

  it('文字列に対する大小比較は落ちずに false になる', () => {
    expect(evalConditions({ mode: 'all', items: [cond('v3', '>', 'あ')] }, { v3: 'い' }, variables)).toBe(false)
  })
})

describe('applyEffects', () => {
  it('加算・減算', () => {
    const vars = applyEffects([effect('v1', 'add', 3)], { v1: 1 }, variables)
    expect(vars.v1).toBe(4)
    expect(applyEffects([effect('v1', 'sub', 2)], vars, variables).v1).toBe(2)
  })

  it('boolean の反転', () => {
    expect(applyEffects([effect('v2', 'toggle', false)], { v2: false }, variables).v2).toBe(true)
  })

  it('元の状態を書き換えない', () => {
    const before = { v1: 1 }
    applyEffects([effect('v1', 'add', 1)], before, variables)
    expect(before.v1).toBe(1)
  })

  it('削除された変数への操作は無視する', () => {
    expect(applyEffects([effect('gone', 'add', 1)], { v1: 0 }, variables)).toEqual({ v1: 0 })
  })

  it('型に合わない操作は値を壊さない', () => {
    expect(applyEffects([effect('v2', 'add', 1)], { v2: true }, variables).v2).toBe(true)
  })
})
