import { Suspense, lazy, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { GitBranch, ListTree, PanelRightClose, PanelRightOpen, ScanSearch, ScrollText } from 'lucide-react'
import { useProject } from '@/store/project'
import { TopBar } from '@/components/TopBar'
import { SceneList } from '@/components/SceneList'
import { CharacterPanel } from '@/components/CharacterPanel'
import { VariablePanel } from '@/components/VariablePanel'
import { SceneEditor } from '@/components/SceneEditor'
import { Inspector } from '@/components/Inspector'
import { PreviewPlayer } from '@/components/PreviewPlayer'
import { SearchReplaceModal } from '@/components/SearchReplaceModal'
import { IconButton, Toaster } from '@/components/ui'
import type { SearchResult } from '@/lib/search'
import { applyTheme, loadTheme, saveTheme, type Theme } from '@/lib/theme'

/** React Flow は重いので、フロータブを開くまで読み込まない */
const FlowView = lazy(() => import('@/components/FlowView').then((m) => ({ default: m.FlowView })))

type Tab = 'script' | 'flow'
type MobilePane = 'structure' | 'editor' | 'inspector'

const TABS: { id: Tab; label: string; icon: typeof ScrollText }[] = [
  { id: 'script', label: '台本', icon: ScrollText },
  { id: 'flow', label: 'フロー', icon: GitBranch },
]

const INSPECTOR_KEY = 'scenario-editor:inspector-open'

export default function App() {
  const [tab, setTab] = useState<Tab>('script')
  const [preview, setPreview] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => loadTheme())
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor')
  // 右パネルは常時必要な情報ではないので、書くことに集中したいときは畳めるようにする
  const [inspectorOpen, setInspectorOpen] = useState(() => localStorage.getItem(INSPECTOR_KEY) !== '0')
  const toggleInspector = () =>
    setInspectorOpen((open) => {
      localStorage.setItem(INSPECTOR_KEY, open ? '0' : '1')
      return !open
    })

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  const navigateToLocation = (sceneId: string, lineId?: string) => {
    setTab('script')
    setMobilePane('editor')
    useProject.getState().selectScene(sceneId)
    setSearchOpen(false)
    window.setTimeout(() => {
      const target = lineId
        ? document.querySelector<HTMLElement>(`[data-line-id="${lineId}"]`)
        : document.querySelector<HTMLElement>('[data-scene-editor]')
      target?.scrollIntoView({ behavior: 'smooth', block: lineId ? 'center' : 'start' })
      if (!lineId || !target) return
      target.classList.add('search-result-flash')
      window.setTimeout(() => target.classList.remove('search-result-flash'), 1800)
    }, 60)
  }

  const navigateToResult = (result: SearchResult) => {
    if (result.sceneId) navigateToLocation(result.sceneId, result.lineId)
  }

  /* グローバルショートカット */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      // 台本本文の Ctrl/⌘+Enter は「次の行を追加」が受け持つ。
      if (key === 'enter' && e.target instanceof HTMLTextAreaElement) return
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) useProject.getState().redo()
        else useProject.getState().undo()
      } else if (key === 'y') {
        e.preventDefault()
        useProject.getState().redo()
      } else if (key === 'enter') {
        e.preventDefault()
        setPreview(true)
      } else if (key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        onPreview={() => setPreview(true)}
        onSearch={() => setSearchOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      />

      <nav className="workspace-switcher grid h-11 shrink-0 grid-cols-3 lg:hidden" aria-label="ワークスペース">
        {([
          { id: 'structure', label: '構成', icon: ListTree },
          { id: 'editor', label: '台本', icon: ScrollText },
          { id: 'inspector', label: '検証', icon: ScanSearch },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-pressed={mobilePane === id}
            onClick={() => {
              setMobilePane(id)
              if (id === 'inspector' && !inspectorOpen) setInspectorOpen(true)
            }}
            className="workspace-tab flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-ink-400"
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      <div
        className={clsx(
          'grid min-h-0 min-w-0 flex-1 grid-cols-1 lg:grid',
          inspectorOpen ? 'lg:grid-cols-[19rem_minmax(0,1fr)_20rem]' : 'lg:grid-cols-[19rem_minmax(0,1fr)]',
        )}
      >
        <aside className={clsx('workspace-pane min-h-0 flex-col gap-5 overflow-y-auto border-r border-ink-700 p-3 lg:flex', mobilePane === 'structure' ? 'flex' : 'hidden')}>
          <SceneList />
          <CharacterPanel />
          <VariablePanel />
        </aside>

        {/* min-h-0/min-w-0 がないとグリッドアイテムが中身の高さに広がり、内側の overflow-y-auto が効かない */}
        <main className={clsx('workspace-canvas min-h-0 min-w-0 flex-col lg:flex', mobilePane === 'editor' ? 'flex' : 'hidden')}>
          <nav className="flex h-11 shrink-0 items-stretch gap-2 border-b border-ink-700 px-4">
            <div className="flex items-stretch gap-4">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-pressed={tab === id}
                  className={clsx(
                    'workspace-tab flex items-center gap-1.5 whitespace-nowrap px-1 text-[13px] font-semibold',
                    tab === id
                      ? 'text-ink-100'
                      : 'text-ink-400 hover:text-ink-100',
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <IconButton
              label={inspectorOpen ? '右パネルを隠す' : '右パネルを表示'}
              variant="ghost"
              onClick={toggleInspector}
            >
              {inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </IconButton>
          </nav>

          <div className="min-h-0 flex-1">
            {tab === 'script' ? (
              <SceneEditor />
            ) : (
              <Suspense fallback={<div className="grid h-full place-items-center text-ink-400">読み込み中…</div>}>
                <FlowView />
              </Suspense>
            )}
          </div>
        </main>

        {inspectorOpen && (
          <aside className={clsx('workspace-pane min-h-0 overflow-y-auto border-l border-ink-700 p-3 lg:block', mobilePane === 'inspector' ? 'block' : 'hidden')}>
            <Inspector onNavigate={navigateToLocation} />
          </aside>
        )}
      </div>

      {preview && <PreviewPlayer onClose={() => setPreview(false)} />}
      <SearchReplaceModal open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigateToResult} />
      <Toaster />
    </div>
  )
}
