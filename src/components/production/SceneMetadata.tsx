import { useEffect, useState } from 'react'
import { ENDING_TYPES, ENDING_TYPE_LABEL, SCENE_STATUSES, SCENE_STATUS_LABEL, type Scene } from '@/types'
import { useProject } from '@/store/project'

export function SceneMetadata({ scene }: { scene: Scene }) {
  const updateScene = useProject((state) => state.updateScene)
  const [tags, setTags] = useState(scene.tags.join(', '))

  useEffect(() => setTags(scene.tags.join(', ')), [scene.id, scene.tags])

  const commitTags = () => {
    const normalized = [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))]
    updateScene(scene.id, { tags: normalized })
    setTags(normalized.join(', '))
  }

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1.4fr_1fr]">
      <label className="flex flex-col gap-1 text-[11px] text-ink-400">
        チャプター
        <input
          value={scene.chapter}
          onChange={(event) => updateScene(scene.id, { chapter: event.target.value })}
          placeholder="未分類"
          className="field-input text-xs"
        />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink-400">
        制作状態
        <select value={scene.status} onChange={(event) => updateScene(scene.id, { status: event.target.value as Scene['status'] })} className="field-input cursor-pointer text-xs">
          {SCENE_STATUSES.map((status) => <option key={status} value={status}>{SCENE_STATUS_LABEL[status]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink-400">
        タグ（カンマ区切り）
        <input value={tags} onChange={(event) => setTags(event.target.value)} onBlur={commitTags} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} placeholder="共通, 日常" className="field-input text-xs" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-ink-400">
        エンディング
        <select value={scene.ending ?? ''} onChange={(event) => updateScene(scene.id, { ending: (event.target.value || null) as Scene['ending'] })} className="field-input cursor-pointer text-xs">
          <option value="">設定なし</option>
          {ENDING_TYPES.map((type) => <option key={type} value={type}>{ENDING_TYPE_LABEL[type]} END</option>)}
        </select>
      </label>
    </div>
  )
}

