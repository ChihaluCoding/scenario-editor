import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { MessageSquare, ArrowRightLeft, GitBranch, Sparkles, StickyNote, Type, Variable } from 'lucide-react'
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

function AddLineBar({ sceneId }: { sceneId: string }) {
  const addLine = useProject((s) => s.addLine)
  return (
    <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-ink-700 bg-ink-900/95 py-3 backdrop-blur">
      {(Object.keys(LINE_META) as LineKind[]).map((kind) => {
        const Icon = KIND_ICONS[kind]
        return (
          <Button
            key={kind}
            variant={kind === 'say' ? 'primary' : 'solid'}
            title={LINE_META[kind].hint}
            onClick={() => addLine(sceneId, kind)}
          >
            <Icon size={14} />
            {LINE_META[kind].label}
          </Button>
        )
      })}
    </div>
  )
}

export function SceneEditor() {
  const scene = useSelectedScene()
  const edit = useProject((s) => s.edit)
  const reorderLines = useProject((s) => s.reorderLines)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

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
    <div data-scene-editor className="flex h-full min-w-0 flex-col overflow-y-auto px-6">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-ink-700 bg-ink-900/95 pt-5 pb-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <input
            value={scene.title}
            onChange={(e) => patchScene((s) => void (s.title = e.target.value), 'title')}
            placeholder="シーン名"
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xl font-bold outline-none transition hover:border-ink-700 focus:border-brand focus:bg-ink-950/60"
          />
          <span className="shrink-0 text-xs text-ink-400">
            {scene.lines.length} 行 / {sceneCharCount(scene)} 字
          </span>
          <TemplateManager sceneId={scene.id} lineCount={scene.lines.length} />
        </div>

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
      </div>

      <div className="flex flex-col gap-2 py-4">
        {scene.lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-700 py-16 text-center text-ink-400">
            まだ行がありません。下のボタンから追加してください。
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
      </div>

      <AddLineBar sceneId={scene.id} />
    </div>
  )
}
