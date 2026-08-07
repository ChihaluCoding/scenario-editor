import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { clsx } from 'clsx'
import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, GripVertical, Play, Plus, Trash2 } from 'lucide-react'
import { useProject } from '@/store/project'
import { sceneCharCount } from '@/lib/analysis'
import { ENDING_TYPE_LABEL, SCENE_STATUSES, SCENE_STATUS_LABEL, type Scene, type SceneStatus } from '@/types'
import { IconButton, PanelHeading } from './ui'
import { useAppDialog } from './dialogs/appDialogContext'

const SceneRow = memo(function SceneRow({ scene, index }: { scene: Scene; index: number }) {
  const selected = useProject((s) => s.selectedSceneId === scene.id)
  const isStart = useProject((s) => s.project.startSceneId === scene.id)
  const canDelete = useProject((s) => s.project.scenes.length > 1)
  const { selectScene, removeScene, duplicateScene, setStartScene } = useProject.getState()
  const { confirmAction } = useAppDialog()

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: scene.id })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(
        'group relative flex items-center gap-1 rounded-md py-1.5 pr-1 pl-1 transition-colors',
        selected ? 'bg-brand/8 outline outline-1 outline-brand/20' : 'hover:bg-ink-800',
        isDragging && 'z-10 opacity-80 shadow-pop',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-ink-400 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
        aria-label="並べ替え"
      >
        <GripVertical size={14} />
      </button>

      <button onClick={() => selectScene(scene.id)} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
        <span className="flex w-full items-center gap-1.5">
          {isStart && <Play size={10} className="shrink-0 fill-good text-good" />}
          <span className={clsx('truncate', selected ? 'font-semibold text-ink-100' : 'font-medium text-ink-300')}>
            {scene.title || '(無題)'}
          </span>
          {scene.ending && <span className="shrink-0 rounded bg-warn/12 px-1 text-[9px] font-semibold text-warn">{ENDING_TYPE_LABEL[scene.ending]}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] tabular-nums text-ink-400">
          <span className={clsx('size-1.5 rounded-full', scene.status === 'done' ? 'bg-good' : scene.status === 'review' ? 'bg-warn' : scene.status === 'writing' ? 'bg-brand' : 'bg-ink-600')} />
          #{index + 1} · {scene.lines.length}行 · {sceneCharCount(scene)}字
        </span>
      </button>

      <div className="context-actions flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {!isStart && (
          <IconButton size="sm" label="開始シーンにする" variant="ghost" onClick={() => setStartScene(scene.id)}>
            <Play size={12} />
          </IconButton>
        )}
        <IconButton size="sm" label="複製" variant="ghost" onClick={() => duplicateScene(scene.id)}>
          <Copy size={12} />
        </IconButton>
        <IconButton
          size="sm"
          label="削除"
          variant="danger"
          disabled={!canDelete}
          onClick={async () => {
            const accepted = await confirmAction({
              title: `シーン「${scene.title}」を削除しますか？`,
              description: 'このシーンに含まれる台本行も削除されます。',
              confirmLabel: '削除',
              tone: 'danger',
            })
            if (accepted) removeScene(scene.id)
          }}
        >
          <Trash2 size={12} />
        </IconButton>
      </div>
    </li>
  )
})

export function SceneList() {
  const scenes = useProject((s) => s.project.scenes)
  const addScene = useProject((s) => s.addScene)
  const edit = useProject((s) => s.edit)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [chapterFilter, setChapterFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | SceneStatus>('')
  const [tagFilter, setTagFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const chapters = useMemo(() => [...new Set(scenes.map((scene) => scene.chapter || '未分類'))], [scenes])
  const filtered = useMemo(() => scenes.filter((scene) => {
    if (chapterFilter && scene.chapter !== chapterFilter) return false
    if (statusFilter && scene.status !== statusFilter) return false
    if (tagFilter && !scene.tags.some((tag) => tag.toLocaleLowerCase().includes(tagFilter.toLocaleLowerCase()))) return false
    return true
  }), [scenes, chapterFilter, statusFilter, tagFilter])
  const groups = useMemo(() => {
    const map = new Map<string, Scene[]>()
    for (const scene of filtered) {
      const chapter = scene.chapter || '未分類'
      map.set(chapter, [...(map.get(chapter) ?? []), scene])
    }
    return [...map.entries()]
  }, [filtered])
  const done = scenes.filter((scene) => scene.status === 'done').length

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = scenes.findIndex((s) => s.id === active.id)
    const to = scenes.findIndex((s) => s.id === over.id)
    edit((d) => {
      const [moved] = d.scenes.splice(from, 1)
      d.scenes.splice(to, 0, moved)
    })
  }

  return (
    <section>
      <PanelHeading
        action={
          <IconButton size="sm" label="シーンを追加" variant="ghost" onClick={addScene}>
            <Plus size={14} />
          </IconButton>
        }
      >
        シーン ({scenes.length})
      </PanelHeading>

      <div className="mb-2 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[10px] tabular-nums text-ink-400">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-good" style={{ width: `${scenes.length ? (done / scenes.length) * 100 : 0}%` }} />
          </div>
          <span>{done}/{scenes.length} 完成</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <select value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)} className={clsx('field-input cursor-pointer text-[11px]', !chapterFilter && 'text-ink-400')}>
            <option value="">全チャプター</option>
            {chapters.map((chapter) => <option key={chapter} value={chapter}>{chapter}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '' | SceneStatus)} className={clsx('field-input cursor-pointer text-[11px]', !statusFilter && 'text-ink-400')}>
            <option value="">全制作状態</option>
            {SCENE_STATUSES.map((status) => <option key={status} value={status}>{SCENE_STATUS_LABEL[status]}</option>)}
          </select>
        </div>
        <input value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} placeholder="タグで絞り込み" className="field-input text-[11px]" />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={filtered.map((scene) => scene.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {groups.map(([chapter, chapterScenes]) => {
              const isCollapsed = collapsed.has(chapter)
              return (
                <div key={chapter}>
                  <button
                    onClick={() => setCollapsed((current) => {
                      const next = new Set(current)
                      if (next.has(chapter)) next.delete(chapter)
                      else next.add(chapter)
                      return next
                    })}
                    className="mb-0.5 flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-semibold tracking-[0.06em] text-ink-400 uppercase transition-colors hover:bg-ink-800 hover:text-ink-100"
                  >
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    <span className="truncate">{chapter}</span>
                    <span className="ml-auto">{chapterScenes.length}</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="flex flex-col gap-0.5">
                      {chapterScenes.map((scene) => <SceneRow key={scene.id} scene={scene} index={scenes.indexOf(scene)} />)}
                    </ul>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && <p className="rounded-lg border border-dashed border-ink-700 px-2 py-5 text-center text-xs text-ink-400">条件に合うシーンはありません</p>}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}
