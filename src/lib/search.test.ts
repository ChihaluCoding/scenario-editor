import { describe, expect, it } from 'vitest'
import { sampleProject } from '@/lib/sample'
import { DEFAULT_SEARCH_FILTERS, replaceSearchResults, searchProject } from '@/lib/search'

describe('searchProject', () => {
  it('大文字小文字を区別せず、台本とメタデータを横断検索できる', () => {
    const project = sampleProject()
    project.title = 'School Story'
    project.scenes[0].summary = 'school after dark'
    const results = searchProject(project, 'SCHOOL', DEFAULT_SEARCH_FILTERS)

    expect(results.map((result) => result.id)).toContain('project:title')
    expect(results.map((result) => result.id)).toContain(`scene:${project.scenes[0].id}:summary`)
  })

  it('空の検索語では結果を返さない', () => {
    expect(searchProject(sampleProject(), '', DEFAULT_SEARCH_FILTERS)).toEqual([])
  })

  it('シーンと行の種類で結果を絞り込める', () => {
    const project = sampleProject()
    const targetScene = project.scenes[0]
    const results = searchProject(project, '。', {
      ...DEFAULT_SEARCH_FILTERS,
      sceneId: targetScene.id,
      lineKind: 'say',
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((result) => result.sceneId === targetScene.id && result.category === 'セリフ')).toBe(true)
  })
})

describe('replaceSearchResults', () => {
  it('検索結果に含まれる対象だけを一括置換する', () => {
    const project = sampleProject()
    project.title = '先輩と先輩'
    project.author = '先輩'
    const results = searchProject(project, '先輩', { ...DEFAULT_SEARCH_FILTERS, scope: 'project' })

    const count = replaceSearchResults(project, results, '先輩', '後輩', false)

    expect(count).toBe(3)
    expect(project.title).toBe('後輩と後輩')
    expect(project.author).toBe('後輩')
  })

  it('空の検索語では置換しない', () => {
    const project = sampleProject()
    const before = structuredClone(project)
    expect(replaceSearchResults(project, [], '', '変更', false)).toBe(0)
    expect(project).toEqual(before)
  })
})
