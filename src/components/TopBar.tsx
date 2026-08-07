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
    <header className="app-command-bar flex h-13 shrink-0 items-center gap-2 px-3">
      <span className="brand-mark shrink-0" aria-hidden>
        <BookOpen size={15} />
      </span>

      {/* プロジェクト名＝この画面の主題。著者名は従属情報として下に小さく添える */}
      <div className="hidden min-w-0 items-baseline gap-1.5 sm:flex">
        <input
          value={project.title}
          onChange={(e) => edit((d) => void (d.title = e.target.value), { coalesce: 'title' })}
          placeholder="プロジェクト名"
          className="field-quiet w-44 font-serif text-[15px] font-semibold lg:w-56"
        />
        <input
          value={project.author}
          onChange={(e) => edit((d) => void (d.author = e.target.value), { coalesce: 'author' })}
          placeholder="著者名"
          className="field-quiet hidden w-24 text-xs text-ink-400 xl:block"
        />
      </div>

      <ProjectMenu />

      <div className="flex-1" />

      <span className="hidden items-center gap-1.5 pr-1 text-[10px] font-medium text-ink-400 xl:flex">
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="text-good" />}
        {saving ? '保存中' : '保存済み'}
      </span>

      {/* 履歴・検索・表示切替はアイコン群、作る行為に直結する操作は右端のボタン群 */}
      <div className="hidden items-center gap-0.5 md:flex">
        <IconButton label="元に戻す (Ctrl+Z)" variant="ghost" disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="やり直し (Ctrl+Shift+Z)" variant="ghost" disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} />
        </IconButton>
        <IconButton label="全文検索・置換 (Ctrl+F)" variant="ghost" onClick={onSearch}>
          <Search size={16} />
        </IconButton>
        <AssetLibrary />
        <IconButton
          label={theme === 'light' ? 'ダークモードに切り替え' : 'ホワイトモードに切り替え'}
          variant="ghost"
          onClick={onToggleTheme}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
      </div>

      <div className="mx-1 hidden h-5 w-px shrink-0 bg-ink-700 md:block" />

      <Button variant="primary" onClick={onPreview} aria-label="プレビュー">
        <Play size={14} />
        <span className="hidden sm:inline">プレビュー</span>
      </Button>

      <div className="hidden sm:block">
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
            <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold tracking-[0.08em] text-ink-400 uppercase">エンジン別</div>
            <MenuItem icon={<Gamepad2 size={15} />} onClick={() => { close(); exportRenPy(project); toast('Ren\'Pyスクリプトを書き出しました') }}>Ren'Py (.rpy)</MenuItem>
            <MenuItem icon={<Gamepad2 size={15} />} onClick={() => { close(); exportTyranoScript(project); toast('ティラノスクリプトを書き出しました') }}>ティラノスクリプト (.ks)</MenuItem>
            <MenuItem icon={<FileJson size={15} />} onClick={() => { close(); exportGodotJSON(project); toast('Godot向けJSONを書き出しました') }}>Godot JSON</MenuItem>
            <MenuItem icon={<Code2 size={15} />} onClick={() => { close(); exportUnityCSharp(project); toast('Unity向けC#を書き出しました') }}>Unity C#</MenuItem>
            <MenuItem icon={<Table2 size={15} />} onClick={() => { close(); exportVoiceCSV(project); toast('ボイス収録CSVを書き出しました') }}>ボイス収録 CSV</MenuItem>
            </>
          )}
        </Dropdown>
      </div>

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
