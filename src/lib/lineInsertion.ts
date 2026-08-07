export type LineInsertionPosition = 'before' | 'after'

/** 表示中の行番号と挿入方向から、配列へ渡す安全な挿入位置を求める。 */
export function getLineInsertionIndex(
  lineIndex: number,
  position: LineInsertionPosition,
  lineCount: number,
): number | null {
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lineCount) return null
  return position === 'before' ? lineIndex : lineIndex + 1
}
