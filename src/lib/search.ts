import type { LineKind, Project } from '@/types'

export type SearchScope = 'all' | 'project' | 'scenes' | 'lines' | 'characters' | 'variables'

export interface SearchFilters {
  scope: SearchScope
  sceneId: string
  lineKind: '' | LineKind
  characterId: string
  caseSensitive: boolean
}

export type SearchTarget =
  | { type: 'project'; field: 'title' | 'author' }
  | { type: 'scene'; sceneId: string; field: 'title' | 'summary' }
  | { type: 'line'; sceneId: string; lineId: string; field: 'text' | 'prompt' | 'voice' }
  | { type: 'option'; sceneId: string; lineId: string; optionId: string; field: 'text' }
  | { type: 'character'; characterId: string; field: 'name' | 'note' }
  | { type: 'variable'; variableId: string; field: 'name' | 'note' }

export interface SearchResult {
  id: string
  target: SearchTarget
  sceneId?: string
  lineId?: string
  category: string
  location: string
  text: string
  occurrences: number
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  scope: 'all',
  sceneId: '',
  lineKind: '',
  characterId: '',
  caseSensitive: false,
}

const normalize = (value: string, caseSensitive: boolean) => (caseSensitive ? value : value.toLocaleLowerCase())

/** 文字列内に検索語が現れる回数を数える。空文字は常に0件とする。 */
export function countOccurrences(text: string, query: string, caseSensitive = false): number {
  if (!query) return 0
  const source = normalize(text, caseSensitive)
  const needle = normalize(query, caseSensitive)
  let count = 0
  let from = 0
  while ((from = source.indexOf(needle, from)) >= 0) {
    count += 1
    from += needle.length
  }
  return count
}

function scopeAllows(scope: SearchScope, target: Exclude<SearchScope, 'all'>) {
  return scope === 'all' || scope === target
}

/** 現在のプロジェクトを、画面に表示される文言だけ横断検索する。 */
export function searchProject(project: Project, query: string, filters: SearchFilters): SearchResult[] {
  if (!query) return []
  const results: SearchResult[] = []
  const add = (result: Omit<SearchResult, 'occurrences'>) => {
    const occurrences = countOccurrences(result.text, query, filters.caseSensitive)
    if (occurrences > 0) results.push({ ...result, occurrences })
  }
  const lineOnly = !!filters.lineKind || !!filters.characterId
  const sceneOnly = !!filters.sceneId

  if (!lineOnly && !sceneOnly && scopeAllows(filters.scope, 'project')) {
    add({ id: 'project:title', target: { type: 'project', field: 'title' }, category: 'プロジェクト', location: 'プロジェクト名', text: project.title })
    add({ id: 'project:author', target: { type: 'project', field: 'author' }, category: 'プロジェクト', location: '著者名', text: project.author })
  }

  for (const scene of project.scenes) {
    if (filters.sceneId && filters.sceneId !== scene.id) continue
    if (!lineOnly && scopeAllows(filters.scope, 'scenes')) {
      add({ id: `scene:${scene.id}:title`, target: { type: 'scene', sceneId: scene.id, field: 'title' }, sceneId: scene.id, category: 'シーン', location: `${scene.title || '(無題)'} / シーン名`, text: scene.title })
      add({ id: `scene:${scene.id}:summary`, target: { type: 'scene', sceneId: scene.id, field: 'summary' }, sceneId: scene.id, category: 'シーン', location: `${scene.title || '(無題)'} / あらすじ`, text: scene.summary })
    }
    if (!scopeAllows(filters.scope, 'lines')) continue

    scene.lines.forEach((line, lineIndex) => {
      if (filters.lineKind && filters.lineKind !== line.kind) return
      if (filters.characterId && (line.kind !== 'say' || line.charId !== filters.characterId)) return
      const base = `${scene.title || '(無題)'} / ${lineIndex + 1}行目`

      if (line.kind === 'say') {
        const speaker = project.characters.find((character) => character.id === line.charId)?.name || '話者なし'
        add({ id: `line:${scene.id}:${line.id}:text`, target: { type: 'line', sceneId: scene.id, lineId: line.id, field: 'text' }, sceneId: scene.id, lineId: line.id, category: 'セリフ', location: `${base} / ${speaker}`, text: line.text })
        add({ id: `line:${scene.id}:${line.id}:voice`, target: { type: 'line', sceneId: scene.id, lineId: line.id, field: 'voice' }, sceneId: scene.id, lineId: line.id, category: 'ボイス', location: `${base} / ${speaker}`, text: line.voice })
      } else if (line.kind === 'narration' || line.kind === 'note') {
        add({ id: `line:${scene.id}:${line.id}:text`, target: { type: 'line', sceneId: scene.id, lineId: line.id, field: 'text' }, sceneId: scene.id, lineId: line.id, category: line.kind === 'narration' ? '地の文' : '制作メモ', location: base, text: line.text })
      } else if (line.kind === 'choice') {
        add({ id: `line:${scene.id}:${line.id}:prompt`, target: { type: 'line', sceneId: scene.id, lineId: line.id, field: 'prompt' }, sceneId: scene.id, lineId: line.id, category: '選択肢', location: `${base} / 質問文`, text: line.prompt })
        line.options.forEach((option, optionIndex) => add({ id: `option:${scene.id}:${line.id}:${option.id}`, target: { type: 'option', sceneId: scene.id, lineId: line.id, optionId: option.id, field: 'text' }, sceneId: scene.id, lineId: line.id, category: '選択肢', location: `${base} / 項目 ${optionIndex + 1}`, text: option.text }))
      }
    })
  }

  if (!lineOnly && !sceneOnly && scopeAllows(filters.scope, 'characters')) {
    project.characters.forEach((character) => {
      add({ id: `character:${character.id}:name`, target: { type: 'character', characterId: character.id, field: 'name' }, category: 'キャラクター', location: `${character.name || '(無名)'} / 名前`, text: character.name })
      add({ id: `character:${character.id}:note`, target: { type: 'character', characterId: character.id, field: 'note' }, category: 'キャラクター', location: `${character.name || '(無名)'} / 設定メモ`, text: character.note })
    })
  }

  if (!lineOnly && !sceneOnly && scopeAllows(filters.scope, 'variables')) {
    project.variables.forEach((variable) => {
      add({ id: `variable:${variable.id}:name`, target: { type: 'variable', variableId: variable.id, field: 'name' }, category: '変数', location: `${variable.name || '(無名)'} / 名前`, text: variable.name })
      add({ id: `variable:${variable.id}:note`, target: { type: 'variable', variableId: variable.id, field: 'note' }, category: '変数', location: `${variable.name || '(無名)'} / メモ`, text: variable.note })
    })
  }

  return results
}

function replaceLiteral(text: string, query: string, replacement: string, caseSensitive: boolean) {
  if (!query) return { value: text, count: 0 }
  let value = ''
  let count = 0
  let from = 0
  const source = normalize(text, caseSensitive)
  const needle = normalize(query, caseSensitive)
  let at = source.indexOf(needle)
  while (at >= 0) {
    value += text.slice(from, at) + replacement
    count += 1
    from = at + query.length
    at = source.indexOf(needle, from)
  }
  return { value: count ? value + text.slice(from) : text, count }
}

/** 検索済みの対象だけを置換する。呼び出し側で1つのUndo履歴にまとめる。 */
export function replaceSearchResults(project: Project, results: SearchResult[], query: string, replacement: string, caseSensitive: boolean): number {
  let total = 0
  for (const result of results) {
    const target = result.target
    let holder: Record<string, unknown> | undefined
    if (target.type === 'project') holder = project
    if (target.type === 'scene') holder = project.scenes.find((scene) => scene.id === target.sceneId)
    if (target.type === 'character') holder = project.characters.find((character) => character.id === target.characterId)
    if (target.type === 'variable') holder = project.variables.find((variable) => variable.id === target.variableId)
    if (target.type === 'line' || target.type === 'option') {
      const scene = project.scenes.find((item) => item.id === target.sceneId)
      const line = scene?.lines.find((item) => item.id === target.lineId)
      holder = target.type === 'option' && line?.kind === 'choice'
        ? line.options.find((option) => option.id === target.optionId)
        : line
    }
    if (!holder) continue
    const current = holder[target.field]
    if (typeof current !== 'string') continue
    const replaced = replaceLiteral(current, query, replacement, caseSensitive)
    holder[target.field] = replaced.value
    total += replaced.count
  }
  return total
}

