import { describe, expect, it } from 'vitest'
import { loadTheme, parseTheme, saveTheme } from '@/lib/theme'

describe('theme', () => {
  it('保存済みのダークテーマを復元できる', () => {
    expect(loadTheme({ getItem: () => 'dark' })).toBe('dark')
  })

  it('未設定や不正な値ではホワイトモードになる', () => {
    expect(parseTheme(null)).toBe('light')
    expect(parseTheme('unknown')).toBe('light')
    expect(loadTheme({ getItem: () => { throw new Error('利用不可') } })).toBe('light')
  })

  it('選択したテーマを保存する', () => {
    let saved = ''
    saveTheme('light', { setItem: (_key, value) => { saved = value } })
    expect(saved).toBe('light')
  })
})
