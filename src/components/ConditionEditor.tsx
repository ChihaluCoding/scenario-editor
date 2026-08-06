import { clsx } from 'clsx'
import { Plus, Trash2, Filter, Variable as VariableIcon } from 'lucide-react'
import { useProject } from '@/store/project'
import { newCondition, newEffect } from '@/lib/factory'
import { coerce } from '@/lib/vars'
import {
  COMPARE_OPS,
  EFFECT_OPS,
  EFFECT_OP_LABEL,
  type Condition,
  type ConditionGroup,
  type Effect,
  type VarValue,
  type Variable,
} from '@/types'
import { Button, IconButton } from './ui'

/** 変数の型に合わせた値入力 */
function ValueInput({
  variable,
  value,
  onChange,
}: {
  variable: Variable | undefined
  value: VarValue
  onChange: (v: VarValue) => void
}) {
  if (!variable) return <span className="text-xs text-bad">変数が削除されています</span>

  if (variable.type === 'boolean') {
    return (
      <select
        value={String(coerce('boolean', value))}
        onChange={(e) => onChange(e.target.value === 'true')}
        className="field-input w-24 cursor-pointer"
      >
        <option value="true">ON</option>
        <option value="false">OFF</option>
      </select>
    )
  }
  return (
    <input
      type={variable.type === 'number' ? 'number' : 'text'}
      value={String(value ?? '')}
      onChange={(e) => onChange(coerce(variable.type, e.target.value))}
      className="field-input w-24"
    />
  )
}

function VariableSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const variables = useProject((s) => s.project.variables)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field-input w-36 cursor-pointer">
      {!variables.some((v) => v.id === value) && <option value={value}>(削除済み)</option>}
      {variables.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  )
}

/* ---------------- 条件 ---------------- */

export function ConditionEditor({
  group,
  onChange,
  label = '表示条件',
}: {
  group: ConditionGroup | undefined
  onChange: (g: ConditionGroup | undefined) => void
  label?: string
}) {
  const variables = useProject((s) => s.project.variables)
  const items = group?.items ?? []

  if (variables.length === 0) return null

  const patch = (next: Partial<ConditionGroup>) => onChange({ mode: group?.mode ?? 'all', items, ...next })
  const setItem = (id: string, next: Partial<Condition>) =>
    patch({ items: items.map((c) => (c.id === id ? { ...c, ...next } : c)) })

  if (items.length === 0) {
    return (
      <Button
        variant="ghost"
        className="self-start px-1.5 py-0.5 text-xs text-ink-400 hover:text-ink-100"
        onClick={() => patch({ items: [newCondition(variables[0].id, variables[0].type)] })}
      >
        <Filter size={12} />
        {label}を追加
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-warn/25 bg-warn/6 p-2">
      <div className="flex items-center gap-2 text-[11px] text-warn">
        <Filter size={12} />
        {label}
        <select
          value={group?.mode ?? 'all'}
          onChange={(e) => patch({ mode: e.target.value as 'all' | 'any' })}
          className="field-input w-28 cursor-pointer py-0.5 text-[11px]"
        >
          <option value="all">すべて満たす</option>
          <option value="any">いずれか満たす</option>
        </select>
      </div>

      {items.map((c) => {
        const variable = variables.find((v) => v.id === c.varId)
        return (
          <div key={c.id} className="flex items-center gap-1.5">
            <VariableSelect
              value={c.varId}
              onChange={(id) => {
                const next = variables.find((v) => v.id === id)!
                setItem(c.id, { varId: id, value: coerce(next.type, c.value) })
              }}
            />
            <select
              value={c.op}
              onChange={(e) => setItem(c.id, { op: e.target.value as Condition['op'] })}
              className="field-input w-16 cursor-pointer"
            >
              {COMPARE_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
            <ValueInput variable={variable} value={c.value} onChange={(v) => setItem(c.id, { value: v })} />
            <IconButton
              label="条件を削除"
              variant="danger"
              onClick={() => {
                const rest = items.filter((x) => x.id !== c.id)
                onChange(rest.length ? { mode: group?.mode ?? 'all', items: rest } : undefined)
              }}
            >
              <Trash2 size={12} />
            </IconButton>
          </div>
        )
      })}

      <Button
        variant="ghost"
        className="self-start px-1.5 py-0.5 text-[11px] text-ink-300"
        onClick={() => patch({ items: [...items, newCondition(variables[0].id, variables[0].type)] })}
      >
        <Plus size={12} />
        条件を追加
      </Button>
    </div>
  )
}

/* ---------------- 効果 ---------------- */

export function EffectEditor({
  effects,
  onChange,
  compact,
}: {
  effects: Effect[]
  onChange: (e: Effect[]) => void
  compact?: boolean
}) {
  const variables = useProject((s) => s.project.variables)

  if (variables.length === 0) {
    return <p className="text-xs text-warn">先に左サイドバーで変数を作成してください</p>
  }

  const setItem = (id: string, next: Partial<Effect>) =>
    onChange(effects.map((e) => (e.id === id ? { ...e, ...next } : e)))

  return (
    <div className={clsx('flex flex-col gap-1.5', compact && effects.length === 0 && 'contents')}>
      {effects.map((e) => {
        const variable = variables.find((v) => v.id === e.varId)
        return (
          <div key={e.id} className="flex items-center gap-1.5">
            <VariableSelect
              value={e.varId}
              onChange={(id) => {
                const next = variables.find((v) => v.id === id)!
                setItem(e.id, { varId: id, value: coerce(next.type, e.value) })
              }}
            />
            <select
              value={e.op}
              onChange={(ev) => setItem(e.id, { op: ev.target.value as Effect['op'] })}
              className="field-input w-24 cursor-pointer"
            >
              {EFFECT_OPS.map((op) => (
                <option key={op} value={op}>
                  {EFFECT_OP_LABEL[op]}
                </option>
              ))}
            </select>
            {e.op !== 'toggle' && (
              <ValueInput variable={variable} value={e.value} onChange={(v) => setItem(e.id, { value: v })} />
            )}
            <IconButton label="削除" variant="danger" onClick={() => onChange(effects.filter((x) => x.id !== e.id))}>
              <Trash2 size={12} />
            </IconButton>
          </div>
        )
      })}

      <Button
        variant="ghost"
        className="self-start px-1.5 py-0.5 text-xs text-ink-300"
        onClick={() => onChange([...effects, newEffect(variables[0].id, variables[0].type)])}
      >
        <VariableIcon size={12} />
        変数操作を追加
      </Button>
    </div>
  )
}
