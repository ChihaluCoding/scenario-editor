import type { Condition, ConditionGroup, Effect, Project, VarType, VarValue, Variable } from '@/types'

export type VarState = Record<string, VarValue>

export const defaultValueFor = (type: VarType): VarValue => (type === 'number' ? 0 : type === 'boolean' ? false : '')

/** 変数の宣言型にあわせて値を整える（UI から文字列が来ても壊れないように） */
export function coerce(type: VarType, value: unknown): VarValue {
  switch (type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(String(value ?? '').trim())
      return Number.isFinite(n) ? n : 0
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : value === 'true' || value === 1 || value === '1'
    default:
      return value == null ? '' : String(value)
  }
}

export function initialVars(variables: Variable[]): VarState {
  const state: VarState = {}
  for (const v of variables) state[v.id] = coerce(v.type, v.initial)
  return state
}

function compare(op: Condition['op'], left: VarValue, right: VarValue): boolean {
  switch (op) {
    case '==':
      return left === right
    case '!=':
      return left !== right
    default: {
      // 大小比較は数値としてのみ意味を持つ
      const a = typeof left === 'number' ? left : Number(left)
      const b = typeof right === 'number' ? right : Number(right)
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false
      return op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : a <= b
    }
  }
}

/**
 * 条件グループを評価する。
 * 未設定・空グループは「常に真」とみなすので、条件を付けていない行は素通りする。
 */
export function evalConditions(
  group: ConditionGroup | undefined,
  vars: VarState,
  variables: Variable[],
): boolean {
  if (!group || group.items.length === 0) return true
  const typeOf = (id: string) => variables.find((v) => v.id === id)?.type
  const results = group.items.map((c) => {
    const type = typeOf(c.varId)
    if (!type) return false // 削除済み変数を参照している条件は成立しない
    return compare(c.op, coerce(type, vars[c.varId]), coerce(type, c.value))
  })
  return group.mode === 'all' ? results.every(Boolean) : results.some(Boolean)
}

/** 効果を適用した新しい変数状態を返す（元の state は変更しない） */
export function applyEffects(effects: Effect[], vars: VarState, variables: Variable[]): VarState {
  if (effects.length === 0) return vars
  const next = { ...vars }
  for (const e of effects) {
    const variable = variables.find((v) => v.id === e.varId)
    if (!variable) continue
    const current = coerce(variable.type, next[e.varId])
    switch (e.op) {
      case 'set':
        next[e.varId] = coerce(variable.type, e.value)
        break
      case 'toggle':
        next[e.varId] = variable.type === 'boolean' ? !current : current
        break
      case 'add':
      case 'sub': {
        if (variable.type === 'number') {
          const delta = Number(coerce('number', e.value))
          next[e.varId] = (current as number) + (e.op === 'add' ? delta : -delta)
        } else if (variable.type === 'string' && e.op === 'add') {
          next[e.varId] = `${current}${coerce('string', e.value)}`
        }
        break
      }
    }
  }
  return next
}

/** 条件・効果を人が読める1行に整形する（カードの要約表示用） */
export function describeCondition(group: ConditionGroup | undefined, project: Project): string {
  if (!group || group.items.length === 0) return ''
  const nameOf = (id: string) => project.variables.find((v) => v.id === id)?.name ?? '(削除済み)'
  return group.items
    .map((c) => `${nameOf(c.varId)} ${c.op} ${formatValue(c.value)}`)
    .join(group.mode === 'all' ? ' かつ ' : ' または ')
}

export function describeEffect(effect: Effect, project: Project): string {
  const name = project.variables.find((v) => v.id === effect.varId)?.name ?? '(削除済み)'
  const v = formatValue(effect.value)
  switch (effect.op) {
    case 'set':
      return `${name} = ${v}`
    case 'add':
      return `${name} += ${v}`
    case 'sub':
      return `${name} -= ${v}`
    case 'toggle':
      return `${name} を反転`
  }
}

export const formatValue = (v: VarValue) => (typeof v === 'boolean' ? (v ? 'ON' : 'OFF') : String(v))
