import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
import { AppDialogContext, type ConfirmOptions, type PromptOptions } from './appDialogContext'

type DialogRequest =
  | ({ type: 'confirm'; resolve: (result: boolean) => void } & ConfirmOptions)
  | ({ type: 'prompt'; resolve: (result: string | null) => void } & PromptOptions)

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const [inputValue, setInputValue] = useState('')
  const titleId = useId()
  const descriptionId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const confirmAction = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    setRequest({ type: 'confirm', ...options, resolve })
  }), [])

  const promptText = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    setInputValue(options.initialValue ?? '')
    setRequest({ type: 'prompt', ...options, resolve })
  }), [])

  const cancel = useCallback(() => {
    if (!request) return
    if (request.type === 'confirm') request.resolve(false)
    else request.resolve(null)
    setRequest(null)
  }, [request])

  const submit = useCallback(() => {
    if (!request) return
    if (request.type === 'confirm') request.resolve(true)
    else request.resolve(inputValue.trim() || null)
    setRequest(null)
  }, [request, inputValue])

  /* ダイアログを開いた直後に、操作対象へフォーカスする */
  useEffect(() => {
    if (!request) return
    const timer = window.setTimeout(() => {
      if (request.type === 'prompt') inputRef.current?.focus()
      else primaryRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [request])

  useEffect(() => {
    if (!request) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [request, cancel])

  return (
    <AppDialogContext.Provider value={{ confirmAction, promptText }}>
      {children}
      {request && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-[var(--color-overlay)] p-4 backdrop-blur-sm" onMouseDown={cancel}>
          <div
            role={request.type === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={request.description ? descriptionId : undefined}
            className="w-full max-w-md overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-pop"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-4">
              {request.type === 'confirm' && request.tone === 'danger' && (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-bad/12 text-bad">
                  <AlertTriangle size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="font-semibold text-ink-100">{request.title}</h2>
                {request.description && <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-ink-400">{request.description}</p>}
                {request.type === 'prompt' && (
                  <label className="mt-4 flex flex-col gap-1.5 text-xs text-ink-400">
                    {request.label}
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && inputValue.trim()) submit()
                      }}
                      placeholder={request.placeholder}
                      className="field-input text-sm"
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3">
              <Button onClick={cancel}>{request.cancelLabel ?? 'キャンセル'}</Button>
              <Button
                ref={primaryRef}
                variant={request.type === 'confirm' && request.tone === 'danger' ? 'destructive' : 'primary'}
                disabled={request.type === 'prompt' && !inputValue.trim()}
                onClick={submit}
              >
                {request.confirmLabel ?? (request.type === 'prompt' ? '保存' : '実行')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  )
}
