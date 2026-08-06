import { createContext, useContext } from 'react'

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

export type PromptOptions = {
  title: string
  description?: string
  label: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

export type AppDialogApi = {
  confirmAction: (options: ConfirmOptions) => Promise<boolean>
  promptText: (options: PromptOptions) => Promise<string | null>
}

export const AppDialogContext = createContext<AppDialogApi | null>(null)

export function useAppDialog() {
  const value = useContext(AppDialogContext)
  if (!value) throw new Error('useAppDialog は AppDialogProvider 内で使用してください')
  return value
}
