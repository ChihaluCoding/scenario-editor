export type ToastTone = 'info' | 'bad'

let pushToast: ((message: string, tone?: ToastTone) => void) | null = null

export const toast = (message: string, tone: ToastTone = 'info') => pushToast?.(message, tone)

/** Toasterの表示処理を、UI部品から呼び出せる通知関数へ接続する。 */
export function bindToast(handler: (message: string, tone?: ToastTone) => void) {
  pushToast = handler
  return () => {
    if (pushToast === handler) pushToast = null
  }
}
