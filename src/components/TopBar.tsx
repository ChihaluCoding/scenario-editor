import { useRef } from 'react'
import { BookOpen, Check, ChevronDown, Code2, Download, FileJson, FileText, Gamepad2, Loader2, Moon, Play, Redo2, Search, Sparkles, Sun, Table2, Undo2, Upload } from 'lucide-react'
import { useProject } from '@/store/project'
import { sampleProject } from '@/lib/sample'
import { exportEngineJSON, exportGodotJSON, exportJSON, exportRenPy, exportScript, exportTyranoScript, exportUnityCSharp, exportVoiceCSV, importJSON } from '@/lib/io'
import { Button, Dropdown, IconButton, MenuItem } from './ui'
import { toast } from './toast'
import { ProjectMenu } from './ProjectMenu'
import type { Theme } from '@/lib/theme'
import { AssetLibrary } from './assets/AssetLibrary'

export function TopBar({
  onPreview,
  onSearch,
  theme,
  onToggleTheme,
}: {
  onPreview: () => void
  onSearch: () => void
  theme: Theme
  onToggleTheme: () => void
}) {
  const project = useProject((s) => s.project)
  const edit = useProject((s) => s.edit)
  const undo = useProject((s) => s.undo)
  const redo = useProject((s) => s.redo)
  const canUndo = useProject((s) => s.past.length > 0)
  const canRedo = useProject((s) => s.future.length > 0)
  const saving = useProject((s) => s.saving)
  const importProject = useProject((s) => s.importProject)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <header className="flex h-13 shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-850 px-3">
      <div className="flex items-center gap-2 pr-1 font-semibold whitespace-nowrap">
        <BookOpen size={18} className="text-brand" />
        Scenario Editor
      </div>

      <ProjectMenu />

      <input
        value={project.title}
        onChange={(e) => edit((d) => void (d.title = e.target.value), { coalesce: 'title' })}
        placeholder="プロジェクト名"
        className="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 font-medium outline-none transition hover:border-ink-700 focus:border-brand focus:bg-ink-950/60"
      />
      <input
        value={project.author}
        onChange={(e) => edit((d) => void (d.author = e.target.value), { coalesce: 'author' })}
        placeholder="著者名"
        className="w-28 rounded-md border border-transparent bg-transparent px-2 py-1 text-ink-300 outline-none transition hover:border-ink-700 focus:border-brand focus:bg-ink-950/60"
      />

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <AssetLibrary />
        <IconButton
          label={theme === 'light' ? 'ダークモードに切り替え' : 'ホワイトモードに切り替え'}
          variant="ghost"
          onClick={onToggleTheme}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
        <IconButton label="全文検索・置換 (Ctrl+F)" variant="ghost" onClick={onSearch}>
          <Search size={16} />
        </IconButton>
        <IconButton label="元に戻す (Ctrl+Z)" variant="ghost" disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="やり直し (Ctrl+Shift+Z)" variant="ghost" disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} />
        </IconButton>
      </div>

      <span className="hidden items-center gap-1.5 text-xs text-ink-400 lg:flex">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} className="text-good" />}
        {saving ? '保存中' : '保存済み'}
      </span>

      <Button variant="primary" onClick={onPreview}>
        <Play size={15} />
        プレビュー
      </Button>

      <Dropdown
        trigger={() => (
          <Button variant="solid">
            ファイル
            <ChevronDown size={14} />
          </Button>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon={<Sparkles size={15} />}
              onClick={() => {
                close()
                void importProject(sampleProject())
                toast('サンプルを別プロジェクトとして開きました')
              }}
            >
              サンプルを開く
            </MenuItem>
            <MenuItem
              icon={<Upload size={15} />}
              onClick={() => {
                close()
                fileRef.current?.click()
              }}
            >
              JSON を読み込む
            </MenuItem>
            <div className="my-1 h-px bg-ink-700" />
            <MenuItem
              icon={<Download size={15} />}
              onClick={async () => {
                close()
                await exportJSON(project)
                toast('プロジェクト JSON を書き出しました（画像・音声も同梱）')
              }}
            >
              プロジェクト JSON
            </MenuItem>
            <MenuItem
              icon={<FileText size={15} />}
              onClick={() => {
                close()
                exportScript(project)
                toast('台本 Markdown を書き出しました')
              }}
            >
              台本 Markdown
            </MenuItem>
            <MenuItem
              icon={<FileJson size={15} />}
              onClick={() => {
                close()
                exportEngineJSON(project)
                toast('エンジン用 JSON を書き出しました')
              }}
            >
              エンジン用 JSON
            </MenuItem>
            <div className="my-1 h-px bg-ink-700" />
            <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink-400 uppercase">エンジン別</div>
            <MenuItem icon={<Gamepad2 size={15} />} onClick={() => { close(); exportRenPy(project); toast('Ren\'Pyスクリプトを書き出しました') }}>Ren'Py (.rpy)</MenuItem>
            <MenuItem icon={<Gamepad2 size={15} />} onClick={() => { close(); exportTyranoScript(project); toast('ティラノスクリプトを書き出しました') }}>ティラノスクリプト (.ks)</MenuItem>
            <MenuItem icon={<FileJson size={15} />} onClick={() => { close(); exportGodotJSON(project); toast('Godot向けJSONを書き出しました') }}>Godot JSON</MenuItem>
            <MenuItem icon={<Code2 size={15} />} onClick={() => { close(); exportUnityCSharp(project); toast('Unity向けC#を書き出しました') }}>Unity C#</MenuItem>
            <MenuItem icon={<Table2 size={15} />} onClick={() => { close(); exportVoiceCSV(project); toast('ボイス収録CSVを書き出しました') }}>ボイス収録 CSV</MenuItem>
          </>
        )}
      </Dropdown>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            await importProject(await importJSON(file))
            toast('読み込みました')
          } catch (err) {
            toast(`読み込めませんでした: ${(err as Error).message}`, 'bad')
          }
        }}
      />
    </header>
  )
}
