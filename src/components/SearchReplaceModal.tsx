import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, CaseSensitive, Replace, Search, X } from 'lucide-react'
import { useProject } from '@/store/project'
import { LINE_META, type LineKind } from '@/types'
import {
  DEFAULT_SEARCH_FILTERS,
  replaceSearchResults,
  searchProject,
  type SearchFilters,
  type SearchResult,
  type SearchScope,
} from '@/lib/search'
import { Button, IconButton, Modal } from './ui'
import { toast } from './toast'
import { useAppDialog } from './dialogs/appDialogContext'

const SCOPE_LABELS: Record<SearchScope, string> = {
  all: 'すべて',
  project: 'プロジェクト',
  scenes: 'シーン',
  lines: '台本',
  characters: 'キャラクター',
  variables: '変数',
}

function Highlight({ text, query, caseSensitive }: { text: string; query: string; caseSensitive: boolean }) {
  if (!query) return text
  const source = caseSensitive ? text : text.toLocaleLowerCase()
  const needle = caseSensitive ? query : query.toLocaleLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  let at = source.indexOf(needle)
  while (at >= 0) {
    parts.push(text.slice(from, at))
    parts.push(<mark key={`${at}-${parts.length}`} className="rounded-sm bg-warn/30 px-0.5 text-warn">{text.slice(at, at + query.length)}</mark>)
    from = at + query.length
    at = source.indexOf(needle, from)
  }
  parts.push(text.slice(from))
  return parts
}

export function SearchReplaceModal({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (result: SearchResult) => void
}) {
  const project = useProject((state) => state.project)
  const edit = useProject((state) => state.edit)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS)
  const inputRef = useRef<HTMLInputElement>(null)
  const { confirmAction } = useAppDialog()

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const results = useMemo(() => searchProject(project, query, filters), [project, query, filters])
  const occurrenceCount = results.reduce((total, result) => total + result.occurrences, 0)
  const patchFilters = (patch: Partial<SearchFilters>) => setFilters((current) => ({ ...current, ...patch }))

  const replaceAll = async () => {
    if (!query || occurrenceCount === 0) return
    const accepted = await confirmAction({
      title: `${occurrenceCount}か所を置換しますか？`,
      description: replacement
        ? `一致した文字を「${replacement}」に置換します。この操作は元に戻せます。`
        : '一致した文字を削除します。この操作は元に戻せます。',
      confirmLabel: '置換する',
    })
    if (!accepted) return
    let replaced = 0
    edit((draft) => {
      replaced = replaceSearchResults(draft, results, query, replacement, filters.caseSensitive)
    })
    toast(`${replaced}か所を置換しました`)
  }

  return (
    <Modal open={open} title="全文検索・一括置換" onClose={onClose} className="max-w-4xl">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="検索する文字を入力"
            className="field-input pr-9 pl-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-700 hover:text-ink-100"
              aria-label="検索語を消去"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={filters.caseSensitive}
            onChange={(event) => patchFilters({ caseSensitive: event.target.checked })}
            className="accent-brand"
          />
          <CaseSensitive size={16} />
          大文字と小文字を区別
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-[11px] text-ink-400">
          対象
          <select
            value={filters.scope}
            onChange={(event) => patchFilters({ scope: event.target.value as SearchScope, lineKind: '', characterId: '' })}
            className="field-input cursor-pointer text-xs"
          >
            {(Object.keys(SCOPE_LABELS) as SearchScope[]).map((scope) => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-400">
          シーン
          <select value={filters.sceneId} onChange={(event) => patchFilters({ sceneId: event.target.value })} className="field-input cursor-pointer text-xs">
            <option value="">すべてのシーン</option>
            {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title || '(無題)'}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-400">
          行の種類
          <select
            value={filters.lineKind}
            onChange={(event) => patchFilters({ lineKind: event.target.value as '' | LineKind, scope: event.target.value ? 'lines' : filters.scope })}
            className="field-input cursor-pointer text-xs"
          >
            <option value="">すべての行</option>
            {(Object.keys(LINE_META) as LineKind[]).map((kind) => <option key={kind} value={kind}>{LINE_META[kind].label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-400">
          話者
          <select
            value={filters.characterId}
            onChange={(event) => patchFilters({ characterId: event.target.value, scope: event.target.value ? 'lines' : filters.scope, lineKind: event.target.value ? 'say' : filters.lineKind })}
            className="field-input cursor-pointer text-xs"
          >
            <option value="">すべての話者</option>
            {project.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 border-t border-ink-700 pt-3">
        <div className="relative min-w-0 flex-1">
          <Replace size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
          <input value={replacement} onChange={(event) => setReplacement(event.target.value)} placeholder="置換後の文字（空欄にすると削除）" className="field-input pl-9" />
        </div>
        <Button variant="primary" disabled={!query || occurrenceCount === 0} onClick={replaceAll}>
          すべて置換
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-400">
        <span>{query ? `${results.length}件の項目・${occurrenceCount}か所` : '検索語を入力してください'}</span>
        {(filters.sceneId || filters.lineKind || filters.characterId || filters.scope !== 'all') && (
          <button onClick={() => setFilters(DEFAULT_SEARCH_FILTERS)} className="text-brand hover:underline">絞り込みを解除</button>
        )}
      </div>

      <div className="min-h-48 max-h-[46vh] overflow-y-auto rounded-lg border border-ink-700 bg-ink-900/55">
        {!query ? (
          <div className="grid min-h-48 place-items-center text-sm text-ink-400">プロジェクト内の文言を横断検索できます</div>
        ) : results.length === 0 ? (
          <div className="grid min-h-48 place-items-center text-sm text-ink-400">一致する文言はありません</div>
        ) : (
          <ul className="divide-y divide-ink-700/70">
            {results.map((result) => (
              <li key={result.id} className="group flex items-center gap-3 px-3 py-2.5 hover:bg-ink-800/70">
                <button
                  disabled={!result.sceneId}
                  onClick={() => onNavigate(result)}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-ink-400">
                    <span className="rounded bg-ink-700 px-1.5 py-0.5 text-ink-300">{result.category}</span>
                    <span className="truncate">{result.location}</span>
                    <span className="ml-auto shrink-0">{result.occurrences}か所</span>
                  </div>
                  <p className="truncate text-sm text-ink-100">
                    <Highlight text={result.text} query={query} caseSensitive={filters.caseSensitive} />
                  </p>
                </button>
                {result.sceneId && <IconButton label="この場所へ移動" variant="ghost" onClick={() => onNavigate(result)}><ArrowRight size={15} /></IconButton>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
