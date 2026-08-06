export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'scenario-editor:theme'

/** 保存値が不正または未設定ならホワイトモードを選ぶ。 */
export function parseTheme(value: unknown): Theme {
  return value === 'dark' ? 'dark' : 'light'
}

export function loadTheme(storage: Pick<Storage, 'getItem'> = localStorage): Theme {
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export function saveTheme(theme: Theme, storage: Pick<Storage, 'setItem'> = localStorage) {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // 保存できない環境でも、そのセッション中のテーマ切替は維持する
  }
}

