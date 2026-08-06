import { clsx } from 'clsx'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { bindToast, type ToastTone } from './toast'

/* ---------------- Button ---------------- */

type Variant = 'ghost' | 'solid' | 'primary' | 'danger' | 'destructive'

const VARIANTS: Record<Variant, string> = {
  ghost: 'bg-transparent hover:bg-ink-700/70 border-transparent',
  solid: 'bg-ink-800 hover:bg-ink-700 border-ink-700',
  primary: 'bg-brand text-ink-950 font-semibold border-transparent hover:brightness-110',
  danger: 'bg-transparent border-transparent text-ink-300 hover:bg-bad/15 hover:text-bad',
  destructive: 'bg-bad text-white font-semibold border-transparent hover:brightness-110',
}

export function Button({
  variant = 'solid',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition',
        'disabled:cursor-not-allowed disabled:opacity-35',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

export function IconButton({ label, className, ...props }: ComponentProps<typeof Button> & { label: string }) {
  return <Button {...props} title={label} aria-label={label} className={clsx('px-1.5 py-1', className)} />
}

/* ---------------- Panel / Field ---------------- */

export function PanelHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold tracking-[0.12em] text-ink-400 uppercase">{children}</h2>
      {action}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[11px] text-ink-400">{label}</span>
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
      className={clsx('field-input resize-none leading-relaxed', className)}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className={clsx('w-full max-w-md rounded-xl border border-ink-700 bg-ink-850 shadow-2xl', className)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink-700 px-5 py-3 font-semibold">{title}</div>
        <div className="flex flex-col gap-3 px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------- Dropdown ---------------- */

export function Dropdown({ trigger, children }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode }) {
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
        <div className="absolute right-0 top-full z-40 mt-1.5 flex min-w-52 flex-col gap-0.5 rounded-lg border border-ink-700 bg-ink-850 p-1.5 shadow-2xl">
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
      className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-ink-100 transition hover:bg-ink-700"
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
            'rounded-full border px-4 py-2 text-sm shadow-xl backdrop-blur',
            i.tone === 'bad' ? 'border-bad/60 bg-bad/15 text-bad' : 'border-ink-600 bg-ink-800/95',
          )}
        >
          {i.msg}
        </div>
      ))}
    </div>
  )
}
