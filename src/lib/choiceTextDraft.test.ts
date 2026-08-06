import { describe, expect, it } from 'vitest'
import { choiceTextDraftReducer, createChoiceTextDraft } from './choiceTextDraft'

describe('choiceTextDraftReducer', () => {
  it('通常入力の外部更新を同期する', () => {
    const state = choiceTextDraftReducer(createChoiceTextDraft('a'), { type: 'sync', value: 'ab' })
    expect(state).toEqual({ value: 'ab', composing: false })
  })

  it('IME変換中は古い外部値で入力途中の文字列を上書きしない', () => {
    let state = choiceTextDraftReducer(createChoiceTextDraft(''), { type: 'composition-start' })
    state = choiceTextDraftReducer(state, { type: 'input', value: '選' })
    state = choiceTextDraftReducer(state, { type: 'sync', value: '' })
    state = choiceTextDraftReducer(state, { type: 'input', value: '選択肢' })
    state = choiceTextDraftReducer(state, { type: 'composition-end', value: '選択肢' })

    expect(state).toEqual({ value: '選択肢', composing: false })
  })
})
