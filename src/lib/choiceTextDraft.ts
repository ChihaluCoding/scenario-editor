/** IME 変換中の選択肢テキストを、外部 state の再描画から保護する。 */
export interface ChoiceTextDraft {
  value: string
  composing: boolean
}

export type ChoiceTextDraftAction =
  | { type: 'sync'; value: string }
  | { type: 'composition-start' }
  | { type: 'input'; value: string }
  | { type: 'composition-end'; value: string }

export const createChoiceTextDraft = (value: string): ChoiceTextDraft => ({ value, composing: false })

export function choiceTextDraftReducer(
  state: ChoiceTextDraft,
  action: ChoiceTextDraftAction,
): ChoiceTextDraft {
  switch (action.type) {
    case 'sync':
      return state.composing || state.value === action.value ? state : { ...state, value: action.value }
    case 'composition-start':
      return { ...state, composing: true }
    case 'input':
      return { ...state, value: action.value }
    case 'composition-end':
      return { value: action.value, composing: false }
  }
}
