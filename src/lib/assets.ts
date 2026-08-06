import { useEffect, useState } from 'react'
import { assetIdOf, getAsset, isAssetRef } from './db'

/**
 * `asset:<id>` 参照を表示可能な URL に解決する。
 * 生成した object URL はプロセス内でキャッシュし、同じアセットを何度も読まない。
 */
const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

export async function resolveRef(ref: string): Promise<string> {
  if (!ref) return ''
  if (!isAssetRef(ref)) return ref

  const id = assetIdOf(ref)
  const cached = cache.get(id)
  if (cached) return cached

  let promise = pending.get(id)
  if (!promise) {
    promise = getAsset(id).then((asset) => {
      const url = asset ? URL.createObjectURL(asset.blob) : ''
      if (url) cache.set(id, url)
      pending.delete(id)
      return url
    })
    pending.set(id, promise)
  }
  return promise
}

export function forgetAsset(id: string) {
  const url = cache.get(id)
  if (url) URL.revokeObjectURL(url)
  cache.delete(id)
}

/** 参照（URL でもアセットでも可）を表示用 URL にするフック */
export function useAssetUrl(ref: string | undefined): string {
  const [url, setUrl] = useState(() => (ref && !isAssetRef(ref) ? ref : ''))

  useEffect(() => {
    if (!ref) {
      setUrl('')
      return
    }
    if (!isAssetRef(ref)) {
      setUrl(ref)
      return
    }
    let alive = true
    resolveRef(ref).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [ref])

  return url
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
