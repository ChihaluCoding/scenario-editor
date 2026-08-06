import { useState } from 'react'
import { Hash, Plus, ToggleLeft, Trash2, Type } from 'lucide-react'
import { useProject } from '@/store/project'
import { coerce, defaultValueFor, formatValue } from '@/lib/vars'
import type { VarType, Variable } from '@/types'
import { Button, Field, IconButton, Modal, PanelHeading } from './ui'
import { useAppDialog } from './dialogs/appDialogContext'

const TYPE_META: Record<VarType, { icon: typeof Hash; label: string }> = {
  number: { icon: Hash, label: '数値（好感度・スコア）' },
  boolean: { icon: ToggleLeft, label: 'フラグ（ON / OFF）' },
  string: { icon: Type, label: '文字列（名前など）' },
}

function VariableModal({ variable, onClose }: { variable: Variable; onClose: () => void }) {
  const update = useProject((s) => s.updateVariable)
  return (
    <Modal open title="変数の設定" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>閉じる</Button>}>
      <Field label="変数名">
        <input
          className="field-input"
          value={variable.name}
          onChange={(e) => update(variable.id, { name: e.target.value })}
          autoFocus
        />
      </Field>

      <Field label="種類">
        <select
          className="field-input cursor-pointer"
          value={variable.type}
          onChange={(e) => {
            const type = e.target.value as VarType
            update(variable.id, { type, initial: defaultValueFor(type) })
          }}
        >
          {(Object.keys(TYPE_META) as VarType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="初期値">
        {variable.type === 'boolean' ? (
          <select
            className="field-input cursor-pointer"
            value={String(variable.initial)}
            onChange={(e) => update(variable.id, { initial: e.target.value === 'true' })}
          >
            <option value="false">OFF</option>
            <option value="true">ON</option>
          </select>
        ) : (
          <input
            className="field-input"
            type={variable.type === 'number' ? 'number' : 'text'}
            value={String(variable.initial)}
            onChange={(e) => update(variable.id, { initial: coerce(variable.type, e.target.value) })}
          />
        )}
      </Field>

      <Field label="メモ">
        <input
          className="field-input"
          placeholder="何に使う変数か"
          value={variable.note}
          onChange={(e) => update(variable.id, { note: e.target.value })}
        />
      </Field>
    </Modal>
  )
}

export function VariablePanel() {
  const variables = useProject((s) => s.project.variables)
  const addVariable = useProject((s) => s.addVariable)
  const removeVariable = useProject((s) => s.removeVariable)
  const [editing, setEditing] = useState<string | null>(null)
  const { confirmAction } = useAppDialog()
  const target = variables.find((v) => v.id === editing)

  return (
    <section>
      <PanelHeading
        action={
          <Button
            variant="ghost"
            className="px-1.5 py-0.5 text-ink-300"
            onClick={() => addVariable(`変数 ${variables.length + 1}`, 'number')}
          >
            <Plus size={14} />
          </Button>
        }
      >
        変数・フラグ ({variables.length})
      </PanelHeading>

      {variables.length === 0 && (
        <p className="px-1 text-xs leading-relaxed text-ink-400">
          好感度やフラグを作ると、行や選択肢に条件を付けられます。
        </p>
      )}

      <ul className="flex flex-col gap-0.5">
        {variables.map((v) => {
          const Icon = TYPE_META[v.type].icon
          return (
            <li key={v.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-ink-800">
              <button onClick={() => setEditing(v.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Icon size={14} className="shrink-0 text-ink-400" />
                <span className="truncate">{v.name}</span>
                <span className="shrink-0 text-[11px] text-ink-400">= {formatValue(v.initial)}</span>
              </button>
              <IconButton
                label="削除"
                variant="danger"
                className="opacity-0 transition group-hover:opacity-100"
                onClick={async () => {
                  const accepted = await confirmAction({
                    title: `変数「${v.name}」を削除しますか？`,
                    description: 'この変数を削除すると、使用している条件と操作も外れます。',
                    confirmLabel: '削除',
                    tone: 'danger',
                  })
                  if (accepted) removeVariable(v.id)
                }}
              >
                <Trash2 size={13} />
              </IconButton>
            </li>
          )
        })}
      </ul>

      {target && <VariableModal variable={target} onClose={() => setEditing(null)} />}
    </section>
  )
}
