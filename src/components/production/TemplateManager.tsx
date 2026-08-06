import { useState } from 'react'
import { CopyPlus, Layers3, Trash2 } from 'lucide-react'
import { useProject } from '@/store/project'
import { Button, IconButton, Modal } from '@/components/ui'
import { toast } from '@/components/toast'
import { useAppDialog } from '@/components/dialogs/appDialogContext'

export function TemplateManager({ sceneId, lineCount }: { sceneId: string; lineCount: number }) {
  const templates = useProject((state) => state.project.templates)
  const addTemplate = useProject((state) => state.addTemplate)
  const applyTemplate = useProject((state) => state.applyTemplate)
  const removeTemplate = useProject((state) => state.removeTemplate)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const { confirmAction } = useAppDialog()

  const save = () => {
    if (!name.trim() || lineCount === 0) return
    addTemplate(sceneId, name)
    toast(`「${name.trim()}」をテンプレートに保存しました`)
    setName('')
  }

  return (
    <>
      <Button variant="solid" className="shrink-0 text-xs" onClick={() => setOpen(true)}>
        <Layers3 size={14} />
        テンプレート
      </Button>
      <Modal
        open={open}
        title="シーンテンプレート"
        onClose={() => setOpen(false)}
        className="max-w-lg"
        footer={<Button variant="primary" onClick={() => setOpen(false)}>閉じる</Button>}
      >
        <div className="flex gap-2">
          <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && save()} placeholder="テンプレート名" className="field-input" />
          <Button variant="primary" disabled={!name.trim() || lineCount === 0} onClick={save}>現在の行を保存</Button>
        </div>
        {lineCount === 0 && <p className="text-xs text-warn">行があるシーンを開くと保存できます。</p>}

        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-700 py-8 text-center text-sm text-ink-400">保存済みテンプレートはありません</div>
        ) : (
          <ul className="max-h-72 divide-y divide-ink-700 overflow-y-auto rounded-lg border border-ink-700">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{template.name}</div>
                  <div className="text-[11px] text-ink-400">{template.lines.length}行</div>
                </div>
                <Button
                  variant="solid"
                  className="text-xs"
                  onClick={() => {
                    applyTemplate(sceneId, template.id)
                    toast(`「${template.name}」を追加しました`)
                  }}
                >
                  <CopyPlus size={13} />
                  追加
                </Button>
                <IconButton label="テンプレートを削除" variant="danger" onClick={async () => {
                  const accepted = await confirmAction({
                    title: `「${template.name}」を削除しますか？`,
                    description: '保存済みのテンプレートが削除されます。',
                    confirmLabel: '削除',
                    tone: 'danger',
                  })
                  if (accepted) removeTemplate(template.id)
                }}>
                  <Trash2 size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}
