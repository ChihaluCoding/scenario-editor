import { clsx } from 'clsx'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { bindToast, type ToastTone } from './toast'

/* ---------------- Button ---------------- */

type Variant = 'ghost' | 'solid' | 'primary' | 'danger' | 'destructive'

const VARIANTS: Record<Variant, string> = {
  ghost: 'border-transparent bg-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100',
  solid: 'border-ink-700 bg-ink-850 text-ink-100 shadow-card hover:border-ink-600 hover:bg-ink-800',
  primary: 'border-transparent bg-brand font-semibold text-ink-950 shadow-raised hover:brightness-108',
  danger: 'border-transparent bg-transparent text-ink-400 hover:bg-bad/12 hover:text-bad',
  destructive: 'border-transparent bg-bad font-semibold text-[var(--color-error-ink)] shadow-raised hover:brightness-108',
}

/** 高さは2種類だけ。並んだときに視線の段差が出ないよう、他では上書きしない */
const SIZES = { md: 'h-8 px-3 text-[13px]', sm: 'h-7 px-2 text-xs' } as const

export function Button({
  variant = 'solid',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color,filter,opacity,transform] active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-40',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    />
  )
}

/** size="sm" は行内に並べる小さめの操作ボタン向け（台本行の右側など） */
export function IconButton({
  label,
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      {...props}
      size={size}
      title={label}
      aria-label={label}
      className={clsx('justify-center !px-0', size === 'sm' ? 'w-6' : 'w-[30px]', className)}
    />
  )
}

/* ---------------- Panel / Field ---------------- */

export function PanelHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1.5 flex h-6 items-center justify-between gap-2">
      <h2 className="truncate font-mono text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-ink-400">{label}</span>
      {children}
    </label>
  )
}

/** 高さが内容に追従する textarea */
export function AutoTextarea({ className, value, ...props }: ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      rows={1}
      className={clsx('field-input script-text resize-none', className)}
    />
  )
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className={clsx('w-full max-w-md rounded-xl border border-ink-700 bg-ink-850 shadow-pop', className)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-1 text-[15px] font-semibold">{title}</div>
        <div className="flex flex-col gap-3 px-5 py-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 pt-1 pb-4">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------- Dropdown ---------------- */

export function Dropdown({
  trigger,
  children,
  placement = 'bottom',
  mobileViewport = false,
}: {
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  placement?: 'top' | 'bottom'
  /** 狭い画面ではビューポート基準にして、端の操作ボタンから開いても切れないようにする。 */
  mobileViewport?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {open && (
        <div
          className={clsx(
            'absolute right-0 z-40 flex min-w-56 flex-col gap-0.5 rounded-lg border border-ink-700 bg-ink-850 p-1.5 shadow-pop',
            mobileViewport
              ? 'fixed right-3 bottom-20 left-3 min-w-0 sm:absolute sm:right-0 sm:bottom-full sm:left-auto sm:mb-1.5 sm:min-w-56'
              : placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, ...props }: ComponentProps<'button'> & { icon?: ReactNode }) {
  return (
    <button
      {...props}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-ink-100 transition hover:bg-ink-800"
    >
      <span className="text-ink-400">{icon}</span>
      {children}
    </button>
  )
}

/* ---------------- Toast ---------------- */

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string; tone: ToastTone }[]>([])
  useEffect(() => {
    const handler = (msg: string, tone: ToastTone = 'info') => {
      const id = Date.now() + Math.random()
      setItems((v) => [...v, { id, msg, tone }])
      setTimeout(() => setItems((v) => v.filter((i) => i.id !== id)), 2600)
    }
    return bindToast(handler)
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-100 flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((i) => (
        <div
          key={i.id}
          className={clsx(
            'rounded-full border px-4 py-2 text-[13px] shadow-pop backdrop-blur',
            i.tone === 'bad' ? 'border-bad/50 bg-bad/12 text-bad' : 'border-ink-700 bg-ink-850/95 text-ink-100',
          )}
        >
          {i.msg}
        </div>
      ))}
    </div>
  )
}
