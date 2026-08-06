import { Suspense, lazy, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { GitBranch, ScrollText } from 'lucide-react'
import { useProject } from '@/store/project'
import { TopBar } from '@/components/TopBar'
import { SceneList } from '@/components/SceneList'
import { CharacterPanel } from '@/components/CharacterPanel'
import { VariablePanel } from '@/components/VariablePanel'
import { SceneEditor } from '@/components/SceneEditor'
import { Inspector } from '@/components/Inspector'
import { PreviewPlayer } from '@/components/PreviewPlayer'
import { SearchReplaceModal } from '@/components/SearchReplaceModal'
import { Toaster } from '@/components/ui'
import type { SearchResult } from '@/lib/search'
import { applyTheme, loadTheme, saveTheme, type Theme } from '@/lib/theme'

/** React Flow は重いので、フロータブを開くまで読み込まない */
const FlowView = lazy(() => import('@/components/FlowView').then((m) => ({ default: m.FlowView })))

type Tab = 'script' | 'flow'

const TABS: { id: Tab; label: string; icon: typeof ScrollText }[] = [
  { id: 'script', label: '台本', icon: ScrollText },
  { id: 'flow', label: 'フロー', icon: GitBranch },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('script')
  const [preview, setPreview] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => loadTheme())

  useEffect(() => {
    applyTheme(theme)
    saveTheme(theme)
  }, [theme])

  const navigateToLocation = (sceneId: string, lineId?: string) => {
    setTab('script')
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
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
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
    <div className="flex h-full flex-col">
      <TopBar
        onPreview={() => setPreview(true)}
        onSearch={() => setSearchOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <aside className="flex flex-col gap-5 overflow-y-auto border-r border-ink-700 bg-ink-850 p-3">
          <SceneList />
          <CharacterPanel />
          <VariablePanel />
        </aside>

        {/* min-h-0/min-w-0 がないとグリッドアイテムが中身の高さに広がり、内側の overflow-y-auto が効かない */}
        <main className="flex min-h-0 min-w-0 flex-col">
          <nav className="flex shrink-0 gap-1 border-b border-ink-700 bg-ink-850 px-3">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition',
                  tab === id
                    ? 'border-brand text-ink-100'
                    : 'border-transparent text-ink-400 hover:text-ink-100',
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
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

        <aside className="overflow-y-auto border-l border-ink-700 bg-ink-850 p-3">
          <Inspector onNavigate={navigateToLocation} />
        </aside>
      </div>

      {preview && <PreviewPlayer onClose={() => setPreview(false)} />}
      <SearchReplaceModal open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigateToResult} />
      <Toaster />
    </div>
  )
}
