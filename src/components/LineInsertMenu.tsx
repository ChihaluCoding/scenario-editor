import { ListPlus } from 'lucide-react'
import { LINE_META, type LineKind } from '@/types'
import type { LineInsertionPosition } from '@/lib/lineInsertion'
import { Dropdown, IconButton } from './ui'

const LINE_KINDS = Object.keys(LINE_META) as LineKind[]

export function LineInsertMenu({
  onInsert,
}: {
  onInsert: (kind: LineKind, position: LineInsertionPosition) => void
}) {
  return (
    <Dropdown
      placement="top"
      mobileViewport
      trigger={(open) => (
        <IconButton
          size="sm"
          label="この行の上または下に追加"
          variant="ghost"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <ListPlus size={13} />
        </IconButton>
      )}
    >
      {(close) => (
        <div className="grid grid-cols-2 gap-2" role="menu" aria-label="行を追加">
          {(['before', 'after'] as const).map((position) => (
            <section key={position} className="min-w-28">
              <div className="px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-ink-400">
                {position === 'before' ? 'この行の上に追加' : 'この行の下に追加'}
              </div>
              <div className="flex flex-col gap-0.5">
                {LINE_KINDS.map((kind) => {
                  const meta = LINE_META[kind]
                  return (
                    <button
                      key={kind}
                      role="menuitem"
                      className="flex h-7 items-center gap-2 whitespace-nowrap rounded-md px-2 text-left text-xs text-ink-100 hover:bg-ink-800"
                      aria-label={`${position === 'before' ? 'この行の上' : 'この行の下'}に${meta.label}を追加`}
                      onClick={() => {
                        onInsert(kind, position)
                        close()
                      }}
                    >
                      <span aria-hidden className="size-1.5 shrink-0 rounded-sm" style={{ background: meta.accent }} />
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Dropdown>
  )
}
