import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { nanoid } from 'nanoid'
import { Bookmark, EyeOff, GripVertical, ListTodo, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { choiceTextDraftReducer, createChoiceTextDraft } from '@/lib/choiceTextDraft'
import { useProject } from '@/store/project'
import { LINE_META, type ChoiceOption, type Line } from '@/types'
import { AutoTextarea, Button, IconButton } from './ui'
import { ConditionEditor, EffectEditor } from './ConditionEditor'
import { StageCommandEditor } from './direction/StageCommandEditor'

/** 遷移先シーンを選ぶセレクト */
function SceneSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const scenes = useProject((s) => s.project.scenes)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx('field-input w-52 shrink-0 cursor-pointer', !value && 'text-ink-400')}
    >
      <option value="">{placeholder}</option>
      {scenes.map((s) => (
        <option key={s.id} value={s.id}>
          {s.title || '(無題)'}
        </option>
      ))}
    </select>
  )
}

function ChoiceOptionRow({
  option,
  index,
  canDelete,
  onChange,
  onDelete,
}: {
  option: ChoiceOption
  index: number
  canDelete: boolean
  onChange: (patch: Partial<ChoiceOption>) => void
  onDelete: () => void
}) {
  const hasVariables = useProject((s) => s.project.variables.length > 0)
  const [textDraft, dispatchTextDraft] = useReducer(choiceTextDraftReducer, option.text, createChoiceTextDraft)
  const composingRef = useRef(false)

  useEffect(() => {
    dispatchTextDraft({ type: 'sync', value: option.text })
  }, [option.text])

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-2">
      <div className="flex items-center gap-2">
        <span className="w-4 text-center text-xs text-ink-400">{index + 1}</span>
        <input
          value={textDraft.value}
          onCompositionStart={() => {
            composingRef.current = true
            dispatchTextDraft({ type: 'composition-start' })
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false
            dispatchTextDraft({ type: 'composition-end', value: event.currentTarget.value })
            onChange({ text: event.currentTarget.value })
          }}
          onChange={(event) => {
            const value = event.target.value
            dispatchTextDraft({ type: 'input', value })
            if (!composingRef.current) onChange({ text: value })
          }}
          placeholder="選択肢のテキスト"
          className="field-input flex-1"
        />
        <SceneSelect value={option.next} onChange={(v) => onChange({ next: v })} placeholder="（そのまま続行）" />
        <IconButton label="この選択肢を削除" variant="danger" disabled={!canDelete} onClick={onDelete}>
          <Trash2 size={13} />
        </IconButton>
      </div>

      {hasVariables && (
        <div className="mt-2 flex flex-col gap-1.5 pl-6">
          <ConditionEditor group={option.cond} onChange={(cond) => onChange({ cond })} label="出現条件" />
          {option.cond?.items.length ? (
            <label className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <EyeOff size={11} />
              条件を満たさないとき
              <select
                value={option.whenLocked}
                onChange={(e) => onChange({ whenLocked: e.target.value as ChoiceOption['whenLocked'] })}
                className="field-input w-32 cursor-pointer py-0.5 text-[11px]"
              >
                <option value="hide">非表示にする</option>
                <option value="disable">選べない状態で見せる</option>
              </select>
            </label>
          ) : null}
          <EffectEditor effects={option.effects} onChange={(effects) => onChange({ effects })} compact />
        </div>
      )}
    </div>
  )
}

export function LineCard({ line, sceneId, index }: { line: Line; sceneId: string; index: number }) {
  const characters = useProject((s) => s.project.characters)
  const update = useProject((s) => s.updateLine)
  const remove = useProject((s) => s.removeLine)
  const meta = LINE_META[line.kind]
  const [showTodo, setShowTodo] = useState(Boolean(line.todo))
  const activeCharacter = line.kind === 'say' ? characters.find((character) => character.id === line.charId) : undefined

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })
  const patch = (p: Partial<Line>) => update(sceneId, line.id, p)

  return (
    <div
      ref={setNodeRef}
      data-line-id={line.id}
      style={{ transform: CSS.Translate.toString(transform), transition, borderLeftColor: meta.accent }}
      className={clsx(
        'group grid grid-cols-[auto_5.5rem_1fr_auto] items-start gap-2.5 rounded-lg border border-ink-700 border-l-3 bg-ink-850 p-2.5 transition',
        isDragging ? 'z-10 opacity-85 shadow-2xl' : 'hover:border-ink-600',
        line.bookmarked && 'ring-1 ring-warn/50',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab pt-1.5 text-ink-600 transition group-hover:text-ink-400 active:cursor-grabbing"
        aria-label="並べ替え"
      >
        <GripVertical size={15} />
      </button>

      <div className="pt-1.5 text-xs" style={{ color: meta.accent }}>
        <div className="font-medium">{meta.label}</div>
        <div className="text-[10px] text-ink-600">{index + 1}</div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {/* 実行条件（変数が1つ以上ある場合のみ表示） */}
        <ConditionEditor group={line.cond} onChange={(cond) => patch({ cond })} />

        {line.kind === 'say' && (
          <>
            <div className="flex items-center gap-2">
              <select
                value={line.charId}
                onChange={(e) => patch({ charId: e.target.value })}
                className={clsx('field-input w-44 cursor-pointer', !line.charId && 'text-warn')}
                style={line.charId ? { color: characters.find((c) => c.id === line.charId)?.color } : undefined}
              >
                <option value="">⚠ 話者を選択</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                value={line.voice}
                onChange={(e) => patch({ voice: e.target.value })}
                placeholder="ボイスファイル名（任意）"
                className="field-input flex-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <select value={line.portraitId ?? ''} onChange={(e) => patch({ portraitId: e.target.value })} className="field-input w-44 cursor-pointer text-xs" disabled={!line.charId}>
                <option value="">通常立ち絵</option>
                {activeCharacter?.portraits.map((portrait) => <option key={portrait.id} value={portrait.id}>{portrait.name}</option>)}
              </select>
              <select value={line.position ?? 'center'} onChange={(e) => patch({ position: e.target.value as NonNullable<typeof line.position> })} className="field-input w-28 cursor-pointer text-xs">
                <option value="left">左に表示</option>
                <option value="center">中央に表示</option>
                <option value="right">右に表示</option>
              </select>
            </div>
            <AutoTextarea value={line.text} onChange={(e) => patch({ text: e.target.value })} placeholder="セリフを入力…" />
          </>
        )}

        {line.kind === 'narration' && (
          <AutoTextarea value={line.text} onChange={(e) => patch({ text: e.target.value })} placeholder="地の文・状況描写…" />
        )}

        {line.kind === 'note' && (
          <AutoTextarea
            value={line.text}
            onChange={(e) => patch({ text: e.target.value })}
            placeholder="制作メモ（本編には出力されません）"
            className="bg-purple-500/8 text-ink-300"
          />
        )}

        {line.kind === 'jump' && (
          <SceneSelect value={line.next} onChange={(v) => patch({ next: v })} placeholder="⚠ ジャンプ先を選択" />
        )}

        {line.kind === 'set' && <EffectEditor effects={line.effects} onChange={(effects) => patch({ effects })} />}

        {line.kind === 'stage' && <StageCommandEditor line={line} onChange={patch} />}

        {line.kind === 'choice' && (
          <>
            <input
              value={line.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="質問文（任意）例: どうする？"
              className="field-input"
            />
            {line.options.map((opt, oi) => (
              <ChoiceOptionRow
                key={opt.id}
                option={opt}
                index={oi}
                canDelete={line.options.length > 1}
                onChange={(p) => patch({ options: line.options.map((o) => (o.id === opt.id ? { ...o, ...p } : o)) })}
                onDelete={() => patch({ options: line.options.filter((o) => o.id !== opt.id) })}
              />
            ))}
            <Button
              variant="ghost"
              className="self-start text-xs text-ink-300"
              onClick={() =>
                patch({
                  options: [...line.options, { id: nanoid(6), text: '', next: '', whenLocked: 'hide', effects: [] }],
                })
              }
            >
              <Plus size={13} />
              選択肢を追加
            </Button>
          </>
        )}

        {showTodo && (
          <div className="flex items-center gap-2 rounded-md border border-warn/30 bg-warn/8 p-1.5">
            <ListTodo size={14} className="shrink-0 text-warn" />
            <input value={line.todo ?? ''} onChange={(event) => patch({ todo: event.target.value })} placeholder="要修正の内容を入力" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-400" autoFocus={!line.todo} />
            <IconButton label="TODOを閉じる" variant="ghost" onClick={() => { patch({ todo: '' }); setShowTodo(false) }}><X size={12} /></IconButton>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <IconButton label={line.bookmarked ? 'ブックマークを外す' : 'ブックマーク'} variant="ghost" aria-pressed={Boolean(line.bookmarked)} onClick={() => patch({ bookmarked: !line.bookmarked })} className={line.bookmarked ? 'text-warn opacity-100' : ''}>
          <Bookmark size={14} className={line.bookmarked ? 'fill-current' : ''} />
        </IconButton>
        <IconButton label="TODOを追加" variant="ghost" onClick={() => setShowTodo(true)} className={line.todo ? 'text-warn' : ''}>
          <ListTodo size={14} />
        </IconButton>
        <IconButton label="この行を削除" variant="danger" onClick={() => remove(sceneId, line.id)}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  )
}
