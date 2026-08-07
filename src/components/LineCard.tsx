import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { nanoid } from 'nanoid'
import { Bookmark, EyeOff, Filter, GripVertical, ListTodo, Plus, Trash2, X } from 'lucide-react'
import { memo, useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import { choiceTextDraftReducer, createChoiceTextDraft } from '@/lib/choiceTextDraft'
import { useProject } from '@/store/project'
import { LINE_META, type ChoiceOption, type Line } from '@/types'
import { AutoTextarea, Button, IconButton } from './ui'
import { ConditionEditor, EffectEditor } from './ConditionEditor'
import { initialConditionGroup } from '@/lib/factory'
import { StageCommandEditor } from './direction/StageCommandEditor'
import { LineInsertMenu } from './LineInsertMenu'
import { getLineInsertionIndex, type LineInsertionPosition } from '@/lib/lineInsertion'

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
      className={clsx('field-input w-full cursor-pointer sm:w-52 sm:shrink-0', !value && 'text-ink-400')}
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
  const variables = useProject((s) => s.project.variables)
  const hasVariables = variables.length > 0
  const [textDraft, dispatchTextDraft] = useReducer(choiceTextDraftReducer, option.text, createChoiceTextDraft)
  const composingRef = useRef(false)

  useEffect(() => {
    dispatchTextDraft({ type: 'sync', value: option.text })
  }, [option.text])

  return (
    <div className="rounded-md border border-ink-700 bg-ink-900 p-2">
      <div className="choice-option-controls flex flex-wrap items-center gap-2">
        <span className="w-4 text-center text-[11px] tabular-nums text-ink-400">{index + 1}</span>
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
          className="field-input min-w-40 flex-1"
        />
        <SceneSelect value={option.next} onChange={(v) => onChange({ next: v })} placeholder="（そのまま続行）" />
        {hasVariables && !option.cond?.items.length && (
          <IconButton size="sm" label="出現条件を追加" variant="ghost" onClick={() => onChange({ cond: initialConditionGroup(variables) })}>
            <Filter size={12} />
          </IconButton>
        )}
        <IconButton size="sm" label="この選択肢を削除" variant="danger" disabled={!canDelete} onClick={onDelete}>
          <Trash2 size={13} />
        </IconButton>
      </div>

      {hasVariables && (
        <div className="mt-2 flex min-w-0 flex-col gap-1.5 sm:pl-6">
          <ConditionEditor group={option.cond} onChange={(cond) => onChange({ cond })} label="出現条件" />
          {option.cond?.items.length ? (
            <label className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
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

export const LineCard = memo(function LineCard({ line, sceneId, index }: { line: Line; sceneId: string; index: number }) {
  const characters = useProject((s) => s.project.characters)
  const variables = useProject((s) => s.project.variables)
  const lineCount = useProject((s) => s.project.scenes.find((scene) => scene.id === sceneId)?.lines.length ?? 0)
  const update = useProject((s) => s.updateLine)
  const remove = useProject((s) => s.removeLine)
  const addLine = useProject((s) => s.addLine)
  const meta = LINE_META[line.kind]
  const [showTodo, setShowTodo] = useState(Boolean(line.todo))
  const activeCharacter = line.kind === 'say' ? characters.find((character) => character.id === line.charId) : undefined

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })
  const patch = (p: Partial<Line>) => update(sceneId, line.id, p)

  /** 指定した種類の行を直前または直後へ追加し、主要入力欄へフォーカスを移す。 */
  const insertLine = (kind: Line['kind'], position: LineInsertionPosition) => {
    const insertionIndex = getLineInsertionIndex(index, position, lineCount)
    if (insertionIndex == null) return
    addLine(sceneId, kind, insertionIndex)
    window.requestAnimationFrame(() => {
      const cards = document.querySelectorAll<HTMLElement>('[data-line-id]')
      const next = cards[insertionIndex]
      next?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const primaryInput = next?.querySelector<HTMLElement>('[data-line-primary]')
        ?? next?.querySelector<HTMLElement>('[data-line-content] textarea, [data-line-content] input, [data-line-content] select')
      primaryInput?.focus({ preventScroll: true })
    })
  }

  /** Ctrl/⌘+Enter では従来どおり、同じ種類の行を直後へ追加する。 */
  const addBelow = () => insertLine(line.kind, 'after')

  /** Ctrl/⌘+Enter で次の行へ。IME 変換確定の Enter は拾わない */
  const onTextKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.nativeEvent.isComposing) return
    event.preventDefault()
    event.stopPropagation()
    addBelow()
  }

  return (
    <div
      ref={setNodeRef}
      data-line-id={line.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        'line-card group relative grid items-start gap-2.5 rounded-lg',
        'border border-ink-700 bg-ink-850 px-3 py-3 transition-[border-color,box-shadow]',
        isDragging ? 'z-10 opacity-90 shadow-pop' : 'hover:border-ink-600',
        line.bookmarked && 'ring-1 ring-warn/45',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="line-card-handle cursor-grab pt-1 text-ink-600 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label="並べ替え"
      >
        <GripVertical size={15} />
      </button>

      <div className="line-card-meta flex items-baseline gap-1.5 pt-1">
        <span aria-hidden className="size-1.5 shrink-0 rounded-sm" style={{ background: meta.accent }} />
        <span className="text-[10px] tabular-nums text-ink-400">{index + 1}</span>
        <span className="truncate text-[11px] font-medium" style={{ color: meta.accent }}>
          {meta.label}
        </span>
      </div>

      <div data-line-content className="line-card-content flex min-w-0 flex-col gap-2">
        {/* 実行条件（変数が1つ以上ある場合のみ表示） */}
        <ConditionEditor group={line.cond} onChange={(cond) => patch({ cond })} />

        {line.kind === 'say' && (
          <>
            {/* セリフ本文が主役。話者以外の設定は細い行にまとめて主張を下げる */}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={line.charId}
                onChange={(e) => patch({ charId: e.target.value })}
                className={clsx('field-input w-40 cursor-pointer font-medium', !line.charId && 'text-warn')}
                style={line.charId ? { color: characters.find((c) => c.id === line.charId)?.color } : undefined}
              >
                <option value="">⚠ 話者を選択</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select value={line.portraitId ?? ''} onChange={(e) => patch({ portraitId: e.target.value })} className="field-input w-32 cursor-pointer text-[11px] text-ink-300" disabled={!line.charId}>
                <option value="">通常立ち絵</option>
                {activeCharacter?.portraits.map((portrait) => <option key={portrait.id} value={portrait.id}>{portrait.name}</option>)}
              </select>
              <select value={line.position ?? 'center'} onChange={(e) => patch({ position: e.target.value as NonNullable<typeof line.position> })} className="field-input w-20 cursor-pointer text-[11px] text-ink-300">
                <option value="left">左</option>
                <option value="center">中央</option>
                <option value="right">右</option>
              </select>
              <input
                value={line.voice}
                onChange={(e) => patch({ voice: e.target.value })}
                placeholder="ボイスファイル名"
                className="field-input min-w-32 flex-1 text-[11px] text-ink-300"
              />
            </div>
            <AutoTextarea data-line-primary value={line.text} onChange={(e) => patch({ text: e.target.value })} onKeyDown={onTextKeyDown} placeholder="セリフを入力…（Ctrl+Enter で次の行）" />
          </>
        )}

        {line.kind === 'narration' && (
          <AutoTextarea data-line-primary value={line.text} onChange={(e) => patch({ text: e.target.value })} onKeyDown={onTextKeyDown} placeholder="地の文・状況描写…" />
        )}

        {line.kind === 'note' && (
          <AutoTextarea
            value={line.text}
            data-line-primary
            onChange={(e) => patch({ text: e.target.value })}
            onKeyDown={onTextKeyDown}
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
              data-line-primary
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
              size="sm"
              className="self-start"
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
          <div className="flex items-center gap-2 rounded-md border border-warn/30 bg-warn/8 py-1 pr-1 pl-2">
            <ListTodo size={13} className="shrink-0 text-warn" />
            <input value={line.todo ?? ''} onChange={(event) => patch({ todo: event.target.value })} placeholder="要修正の内容を入力" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-ink-400" autoFocus={!line.todo} />
            <IconButton size="sm" label="TODOを閉じる" variant="ghost" onClick={() => { patch({ todo: '' }); setShowTodo(false) }}><X size={12} /></IconButton>
          </div>
        )}
      </div>

      {/*
        操作は普段は隠し、ホバー・フォーカス時だけ出す。ブックマーク済みは常に見せる。
        縦積みにすると非表示でもボタン数ぶんの高さがカードの高さを決めてしまうため、必ず横並びにする。
      */}
      <div
        className={clsx(
          'line-card-actions context-actions flex flex-row gap-0.5 pt-0.5 transition-opacity',
          line.bookmarked || line.todo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <LineInsertMenu onInsert={insertLine} />
        {variables.length > 0 && !line.cond?.items.length && (
          <IconButton size="sm" label="実行条件を追加" variant="ghost" onClick={() => patch({ cond: initialConditionGroup(variables) })}>
            <Filter size={13} />
          </IconButton>
        )}
        <IconButton size="sm" label={line.bookmarked ? 'ブックマークを外す' : 'ブックマーク'} variant="ghost" aria-pressed={Boolean(line.bookmarked)} onClick={() => patch({ bookmarked: !line.bookmarked })} className={line.bookmarked ? 'text-warn' : ''}>
          <Bookmark size={13} className={line.bookmarked ? 'fill-current' : ''} />
        </IconButton>
        <IconButton size="sm" label="TODOを追加" variant="ghost" onClick={() => setShowTodo(true)} className={line.todo ? 'text-warn' : ''}>
          <ListTodo size={13} />
        </IconButton>
        <IconButton size="sm" label="この行を削除" variant="danger" onClick={() => remove(sceneId, line.id)}>
          <Trash2 size={13} />
        </IconButton>
      </div>
    </div>
  )
})
