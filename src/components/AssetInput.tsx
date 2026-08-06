import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Link2, Upload, X } from 'lucide-react'
import { putAsset } from '@/lib/db'
import { useAssetUrl } from '@/lib/assets'
import { IconButton } from './ui'
import { toast } from './toast'

const MAX_BYTES = 8 * 1024 * 1024

/**
 * 画像・音声の指定欄。URL 直接入力に加えて、
 * ドラッグ＆ドロップ／ファイル選択でブラウザ内（IndexedDB）に取り込める。
 */
export function AssetInput({
  value,
  onChange,
  accept,
  placeholder = 'https://… またはファイルをドロップ',
  preview = 'image',
}: {
  value: string
  onChange: (ref: string) => void
  accept: string
  placeholder?: string
  preview?: 'image' | 'audio' | 'none'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const url = useAssetUrl(value)

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) return toast('ファイルが大きすぎます（8MB まで）', 'bad')
    onChange(await putAsset(file))
    toast(`${file.name} を取り込みました`)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void upload(e.dataTransfer.files[0])
      }}
      className={clsx(
        'flex items-center gap-2 rounded-md border border-dashed p-1 transition',
        dragging ? 'border-brand bg-brand/10' : 'border-transparent',
      )}
    >
      {preview === 'image' && url && (
        <img src={url} alt="" className="size-9 shrink-0 rounded border border-ink-700 object-cover" />
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Link2 size={14} className="shrink-0 text-ink-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="field-input text-xs"
        />
      </div>

      <IconButton label="ファイルを取り込む" variant="solid" onClick={() => inputRef.current?.click()}>
        <Upload size={14} />
      </IconButton>
      {value && (
        <IconButton label="クリア" variant="danger" onClick={() => onChange('')}>
          <X size={14} />
        </IconButton>
      )}

      {preview === 'audio' && url && <audio src={url} controls className="h-8 w-44 shrink-0" />}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          void upload(file)
        }}
      />
    </div>
  )
}
