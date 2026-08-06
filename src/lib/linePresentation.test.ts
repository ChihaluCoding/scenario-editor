import { describe, expect, it } from 'vitest'
import { blankProject, newCharacter, newLine } from '@/lib/factory'
import { describeLine } from '@/lib/linePresentation'

describe('describeLine', () => {
  it('話者名とセリフを詳細表示用の文にまとめる', () => {
    const project = blankProject()
    const character = newCharacter('アリス', 0)
    project.characters.push(character)
    const line = newLine('say')
    if (line.kind !== 'say') throw new Error('セリフ行を作成できませんでした')
    line.charId = character.id
    line.text = 'こんにちは'

    expect(describeLine(line, project)).toBe('アリス：こんにちは')
  })

  it('移動先がないジャンプを未設定として表示する', () => {
    const project = blankProject()
    const line = newLine('jump')

    expect(describeLine(line, project)).toBe('「移動先未設定」へ移動')
  })
})
