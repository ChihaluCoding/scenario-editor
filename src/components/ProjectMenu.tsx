import { useEffect, useState } from 'react'
import { ChevronDown, Copy, FolderOpen, History, Plus, Trash2 } from 'lucide-react'
import { useProject } from '@/store/project'
import { listBackups, type Backup } from '@/lib/db'
import { Button, Dropdown, MenuItem, Modal } from './ui'
import { toast } from './toast'
import { useAppDialog } from './dialogs/appDialogContext'

const when = (t: number) => new Date(t).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })

/** 自動バックアップからの復元 */
function BackupModal({ onClose }: { onClose: () => void }) {
  const projectId = useProject((s) => s.project.id)
  const restore = useProject((s) => s.restoreBackup)
  const [backups, setBackups] = useState<Backup[] | null>(null)

  useEffect(() => {
    void listBackups(projectId).then(setBackups)
  }, [projectId])

  return (
    <Modal open title="バックアップから復元" onClose={onClose} footer={<Button onClick={onClose}>閉じる</Button>}>
      <p className="text-xs text-ink-400">
        編集中は数分おきに自動でスナップショットを保存しています。復元しても Ctrl+Z で元に戻せます。
      </p>
      {backups === null && <p className="text-ink-400">読み込み中…</p>}
      {backups?.length === 0 && <p className="text-ink-400">まだバックアップがありません。</p>}
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {backups?.map((b) => (
          <li key={b.key}>
            <button
              onClick={() => {
                restore(b.data)
                toast(`${when(b.createdAt)} の状態に復元しました`)
                onClose()
              }}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition hover:bg-ink-800"
            >
              <span>{when(b.createdAt)}</span>
              <span className="text-xs text-ink-400">
                {b.data.scenes.length} シーン / {b.data.scenes.reduce((n, s) => n + s.lines.length, 0)} 行
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export function ProjectMenu() {
  const projects = useProject((s) => s.projects)
  const currentId = useProject((s) => s.project.id)
  const currentTitle = useProject((s) => s.project.title)
  const { switchProject, createProject, duplicateProject, deleteProject } = useProject.getState()
  const [showBackups, setShowBackups] = useState(false)
  const { confirmAction } = useAppDialog()

  return (
    <>
      <Dropdown
        // プロジェクト名はトップバーの入力欄に出ているので、ここは切り替え操作だけを担う
        trigger={() => (
          <Button variant="ghost" title={`プロジェクトを切り替え（現在: ${currentTitle || '無題'}）`}>
            <FolderOpen size={15} className="shrink-0" />
            <ChevronDown size={13} className="shrink-0" />
          </Button>
        )}
      >
        {(close) => (
          <>
            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink-400 uppercase">プロジェクト</div>
            <ul className="max-h-64 overflow-y-auto">
              {projects.map((p) => (
                <li key={p.id} className="group flex items-center">
                  <button
                    onClick={() => {
                      close()
                      void switchProject(p.id)
                    }}
                    className={`flex min-w-0 flex-1 flex-col rounded-md px-2.5 py-1.5 text-left transition hover:bg-ink-800 ${
                      p.id === currentId ? 'font-semibold text-brand' : ''
                    }`}
                  >
                    <span className="truncate text-[13px]">{p.title || '無題'}</span>
                    <span className="text-[10px] text-ink-400">{when(p.updatedAt)}</span>
                  </button>
                  <button
                    onClick={async () => {
                      const accepted = await confirmAction({
                        title: `「${p.title}」を完全に削除しますか？`,
                        description: '削除したプロジェクトは復元できません。',
                        confirmLabel: '完全に削除',
                        tone: 'danger',
                      })
                      if (accepted) await deleteProject(p.id)
                    }}
                    className="rounded p-1.5 text-ink-400 opacity-0 transition group-hover:opacity-100 hover:text-bad"
                    aria-label="削除"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>

            <div className="my-1 h-px bg-ink-700" />
            <MenuItem
              icon={<Plus size={15} />}
              onClick={() => {
                close()
                void createProject()
              }}
            >
              新しいプロジェクト
            </MenuItem>
            <MenuItem
              icon={<Copy size={15} />}
              onClick={() => {
                close()
                void duplicateProject()
              }}
            >
              このプロジェクトを複製
            </MenuItem>
            <MenuItem
              icon={<History size={15} />}
              onClick={() => {
                close()
                setShowBackups(true)
              }}
            >
              バックアップから復元
            </MenuItem>
          </>
        )}
      </Dropdown>

      {showBackups && <BackupModal onClose={() => setShowBackups(false)} />}
    </>
  )
}
