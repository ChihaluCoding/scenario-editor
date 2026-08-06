import { describe, expect, it } from 'vitest'
import { blankProject, newCharacter } from '@/lib/factory'
import { generateGodotJSON, generateRenPy, generateTyranoScript, generateUnityCSharp, generateVoiceCSV } from '@/lib/exports/engineAdapters'

describe('engine adapters', () => {
  it('各エンジン向けに空プロジェクトも書き出せる', () => {
    const project = blankProject('テスト')
    expect(generateRenPy(project)).toContain('label scene_')
    expect(generateTyranoScript(project)).toContain('*scene_')
    expect(JSON.parse(generateGodotJSON(project)).title).toBe('テスト')
    expect(generateUnityCSharp(project)).toContain('public static class Scenario_')
  })

  it('収録CSVで引用符をエスケープし、未収録状態を出力する', () => {
    const project = blankProject()
    const character = newCharacter('結衣', 0)
    project.characters.push(character)
    project.scenes[0].lines.push({ id: 'voice_1', kind: 'say', charId: character.id, text: '「はい」', voice: '' })
    const output = generateVoiceCSV(project)
    expect(output).toContain('voice_1')
    expect(output).toContain('未収録')
    expect(output.startsWith('\uFEFF')).toBe(true)
  })
})
