import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MessageSquare, ArrowRightLeft, ChevronDown, ChevronRight, GitBranch, Sparkles, StickyNote, Type, Variable } from 'lucide-react'
import { useState } from 'react'
import { AssetInput } from './AssetInput'
import { useProject, useSelectedScene } from '@/store/project'
import { sceneCharCount } from '@/lib/analysis'
import { LINE_META, type LineKind } from '@/types'
import { Button, Field } from './ui'
import { LineCard } from './LineCard'
import { SceneMetadata } from './production/SceneMetadata'
import { TemplateManager } from './production/TemplateManager'

const KIND_ICONS: Record<LineKind, typeof MessageSquare> = {
  say: MessageSquare,
  narration: Type,
  choice: GitBranch,
  jump: ArrowRightLeft,
  set: Variable,
  note: StickyNote,
  stage: Sparkles,
}

function focusAddedLine(position: number) {
  window.requestAnimationFrame(() => {
    const card = document.querySelectorAll<HTMLElement>('[data-line-id]')[position]
    if (!card) return
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const primaryInput = card.querySelector<HTMLElement>('[data-line-primary]')
      ?? card.querySelector<HTMLElement>('[data-line-content] textarea, [data-line-content] input, [data-line-content] select')
    primaryInput?.focus({ preventScroll: true })
  })
}

function AddLineBar({ sceneId, lineCount }: { sceneId: string; lineCount: number }) {
  const addLine = useProject((s) => s.addLine)
  const addAtEnd = (kind: LineKind) => {
    addLine(sceneId, kind)
    focusAddedLine(lineCount)
  }

  return (
    <div className="sticky bottom-0 -mx-5 mt-auto border-t border-ink-700 bg-ink-900/92 px-5 py-2.5 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="pr-1 text-[11px] text-ink-400">行を追加</span>
        {(Object.keys(LINE_META) as LineKind[]).map((kind) => {
          const Icon = KIND_ICONS[kind]
          return (
            <Button
              key={kind}
              variant={kind === 'say' ? 'primary' : 'solid'}
              title={LINE_META[kind].hint}
              onClick={() => addAtEnd(kind)}
            >
              <Icon size={14} style={kind === 'say' ? undefined : { color: LINE_META[kind].accent }} />
              {LINE_META[kind].label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

const DETAILS_KEY = 'scenario-editor:scene-details-open'

export function SceneEditor() {
  const scene = useSelectedScene()
  const edit = useProject((s) => s.edit)
  const reorderLines = useProject((s) => s.reorderLines)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  // シーン設定は常時表示だとヘッダーが縦を食うので折りたためるようにする
  const [detailsOpen, setDetailsOpen] = useState(() => localStorage.getItem(DETAILS_KEY) !== '0')
  const toggleDetails = () =>
    setDetailsOpen((open) => {
      localStorage.setItem(DETAILS_KEY, open ? '0' : '1')
      return !open
    })

  const patchScene = (recipe: (s: NonNullable<typeof scene>) => void, coalesce?: string) =>
    edit((d) => {
      const target = d.scenes.find((x) => x.id === scene.id)
      if (target) recipe(target)
    }, coalesce ? { coalesce: `${coalesce}:${scene.id}` } : undefined)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = scene.lines.findIndex((l) => l.id === active.id)
    const to = scene.lines.findIndex((l) => l.id === over.id)
    if (from >= 0 && to >= 0) reorderLines(scene.id, from, to)
  }

  return (
    <div data-scene-editor className="flex h-full min-w-0 flex-col overflow-y-auto px-5">
      <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-2.5 border-b border-ink-700 bg-ink-900/92 px-5 pt-3.5 pb-3 backdrop-blur">
        <div className="scene-editor-titlebar flex flex-wrap items-center gap-1.5">
          <button
            onClick={toggleDetails}
            title={detailsOpen ? 'シーン設定を折りたたむ' : 'シーン設定を開く'}
            aria-expanded={detailsOpen}
            className="shrink-0 rounded-md p-1 text-ink-400 transition hover:bg-ink-800 hover:text-ink-100"
          >
            {detailsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <input
            value={scene.title}
            onChange={(e) => patchScene((s) => void (s.title = e.target.value), 'title')}
            placeholder="シーン名"
            className="field-quiet min-w-0 flex-1 text-[19px] leading-tight font-bold"
          />
          <span className="chip shrink-0 tabular-nums">
            {scene.lines.length}行 · {sceneCharCount(scene)}字
          </span>
          <TemplateManager sceneId={scene.id} lineCount={scene.lines.length} />
        </div>

        {detailsOpen && (
          <>
            <div className="flex gap-3">
              <Field label="あらすじ・演出メモ">
                <input
                  value={scene.summary}
                  onChange={(e) => patchScene((s) => void (s.summary = e.target.value), 'summary')}
                  placeholder="このシーンで何が起きるか"
                  className="field-input"
                />
              </Field>
            </div>

            <SceneMetadata scene={scene} />

            <div className="flex gap-3">
              <Field label="背景画像">
                <AssetInput
                  value={scene.bg}
                  onChange={(v) => patchScene((s) => void (s.bg = v), 'bg')}
                  accept="image/*"
                />
              </Field>
              <Field label="BGM">
                <AssetInput
                  value={scene.bgm}
                  onChange={(v) => patchScene((s) => void (s.bgm = v), 'bgm')}
                  accept="audio/*"
                  preview="audio"
                  placeholder="音声 URL またはファイルをドロップ"
                />
              </Field>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5 py-4">
        {scene.lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-700 px-6 py-16 text-center">
            <p className="text-ink-300">まだ行がありません</p>
            <p className="mt-1 text-xs text-ink-400">下のボタンから追加できます。入力中の Ctrl+Enter で次の行が続きます。</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={scene.lines.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {scene.lines.map((line, i) => (
                <LineCard key={line.id} line={line} sceneId={scene.id} index={i} />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {scene.lines.length > 0 && <div aria-hidden className="h-[clamp(8rem,28vh,16rem)] shrink-0" />}
      </div>

      <AddLineBar sceneId={scene.id} lineCount={scene.lines.length} />
    </div>
  )
}
