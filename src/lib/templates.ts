import { nanoid } from 'nanoid'
import type { Line } from '@/types'

/** テンプレートを何度適用しても参照IDが衝突しないよう、入れ子を含めて再採番する。 */
export function cloneTemplateLines(lines: Line[]): Line[] {
  return structuredClone(lines).map((line) => {
    line.id = nanoid(8)
    if (line.cond) {
      line.cond.items = line.cond.items.map((condition) => ({ ...condition, id: nanoid(6) }))
    }
    if (line.kind === 'set') {
      line.effects = line.effects.map((effect) => ({ ...effect, id: nanoid(6) }))
    }
    if (line.kind === 'choice') {
      line.options = line.options.map((option) => ({
        ...option,
        id: nanoid(6),
        cond: option.cond
          ? { ...option.cond, items: option.cond.items.map((condition) => ({ ...condition, id: nanoid(6) })) }
          : undefined,
        effects: option.effects.map((effect) => ({ ...effect, id: nanoid(6) })),
      }))
    }
    return line
  })
}
