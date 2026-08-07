import { describe, expect, it } from 'vitest'
import { getLineInsertionIndex } from './lineInsertion'

describe('getLineInsertionIndex', () => {
  it('行の直前と直後の挿入位置を返す', () => {
    expect(getLineInsertionIndex(2, 'before', 5)).toBe(2)
    expect(getLineInsertionIndex(2, 'after', 5)).toBe(3)
    expect(getLineInsertionIndex(0, 'before', 5)).toBe(0)
    expect(getLineInsertionIndex(4, 'after', 5)).toBe(5)
  })

  it('存在しない行位置では追加位置を返さない', () => {
    expect(getLineInsertionIndex(-1, 'before', 5)).toBeNull()
    expect(getLineInsertionIndex(5, 'after', 5)).toBeNull()
    expect(getLineInsertionIndex(0.5, 'before', 5)).toBeNull()
    expect(getLineInsertionIndex(0, 'after', 0)).toBeNull()
  })
})
