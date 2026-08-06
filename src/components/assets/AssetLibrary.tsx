import { useCallback, useEffect, useMemo, useState } from 'react'
import { File, Images, Music2, Search, Trash2 } from 'lucide-react'
import { assetKind, collectAssetUsage, duplicateCandidateIds, type AssetKind } from '@/lib/assetCatalog'
import { ASSET_PREFIX, deleteAsset, listAssets, loadProject, updateAssetTags, type StoredAsset } from '@/lib/db'
import { forgetAsset, formatBytes, useAssetUrl } from '@/lib/assets'
import { useProject } from '@/store/project'
import { Button, IconButton, Modal } from '@/components/ui'
import { toast } from '@/components/toast'
import { useAppDialog } from '@/components/dialogs/appDialogContext'

const KIND_LABEL: Record<'all' | AssetKind, string> = { all: 'すべて', image: '画像', audio: '音声', other: 'その他' }

function AssetPreview({ asset }: { asset: StoredAsset }) {
  const url = useAssetUrl(ASSET_PREFIX + asset.id)
  if (assetKind(asset.type) === 'image' && url) return <img src={url} alt="" className="size-16 rounded-lg border border-ink-700 object-cover" />
  if (assetKind(asset.type) === 'audio') return <span className="grid size-16 place-items-center rounded-lg bg-brand/10 text-brand"><Music2 size={24} /></span>
  return <span className="grid size-16 place-items-center rounded-lg bg-ink-800 text-ink-400"><File size={24} /></span>
}

function AssetRow({
  asset,
  usage,
  duplicate,
  onRefresh,
}: {
  asset: StoredAsset
  usage: string[]
  duplicate: boolean
  onRefresh: () => Promise<void>
}) {
  const [tags, setTags] = useState((asset.tags ?? []).join(', '))
  const { confirmAction } = useAppDialog()
  const used = usage.length > 0
  const saveTags = async () => {
    const normalized = [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))]
    await updateAssetTags(asset.id, normalized)
    setTags(normalized.join(', '))
  }

  return (
    <li className="flex gap-3 rounded-lg border border-ink-700 bg-ink-850 p-2.5">
      <AssetPreview asset={asset} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{asset.name}</div>
            <div className="text-[11px] text-ink-400">{KIND_LABEL[assetKind(asset.type)]} · {formatBytes(asset.size)}</div>
          </div>
          <span className={used ? 'rounded bg-good/10 px-1.5 py-0.5 text-[10px] text-good' : 'rounded bg-warn/10 px-1.5 py-0.5 text-[10px] text-warn'}>{used ? `${usage.length}か所で使用` : '未使用'}</span>
          {duplicate && <span className="rounded bg-bad/10 px-1.5 py-0.5 text-[10px] text-bad">重複候補</span>}
        </div>
        <input value={tags} onChange={(event) => setTags(event.target.value)} onBlur={() => void saveTags()} placeholder="タグ（カンマ区切り）" className="field-input mt-2 py-1 text-xs" />
        {used && <div className="mt-1 truncate text-[10px] text-ink-400" title={usage.join('\n')}>{usage.join('、')}</div>}
      </div>
      <IconButton
        label={used ? '使用中のため削除できません' : '未使用素材を削除'}
        variant="danger"
        disabled={used}
        onClick={async () => {
          const accepted = await confirmAction({
            title: `未使用素材「${asset.name}」を削除しますか？`,
            description: '削除した素材は復元できません。',
            confirmLabel: '削除',
            tone: 'danger',
          })
          if (!accepted) return
          await deleteAsset(asset.id)
          forgetAsset(asset.id)
          await onRefresh()
          toast(`${asset.name}を削除しました`)
        }}
      >
        <Trash2 size={14} />
      </IconButton>
    </li>
  )
}

export function AssetLibrary() {
  const projects = useProject((state) => state.projects)
  const [open, setOpen] = useState(false)
  const [assets, setAssets] = useState<StoredAsset[]>([])
  const [usage, setUsage] = useState<Map<string, string[]>>(new Map())
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | AssetKind>('all')
  const [unusedOnly, setUnusedOnly] = useState(false)

  const refresh = useCallback(async () => {
    const nextUsage = new Map<string, string[]>()
    const loaded = await Promise.all(projects.map((meta) => loadProject(meta.id)))
    for (const project of loaded) {
      if (!project) continue
      for (const [id, locations] of collectAssetUsage(project)) {
        nextUsage.set(id, [...(nextUsage.get(id) ?? []), ...locations.map((location) => `${project.title}: ${location}`)])
      }
    }
    setUsage(nextUsage)
    setAssets(await listAssets())
  }, [projects])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const duplicates = useMemo(() => duplicateCandidateIds(assets), [assets])
  const filtered = useMemo(() => assets.filter((asset) => {
    if (kind !== 'all' && assetKind(asset.type) !== kind) return false
    if (unusedOnly && usage.has(asset.id)) return false
    const needle = query.toLocaleLowerCase()
    return !needle || asset.name.toLocaleLowerCase().includes(needle) || (asset.tags ?? []).some((tag) => tag.toLocaleLowerCase().includes(needle))
  }), [assets, usage, query, kind, unusedOnly])

  return (
    <>
      <IconButton label="アセットライブラリ" variant="ghost" onClick={() => setOpen(true)}><Images size={16} /></IconButton>
      <Modal open={open} title={`アセットライブラリ (${assets.length})`} onClose={() => setOpen(false)} className="max-w-4xl" footer={<Button variant="primary" onClick={() => setOpen(false)}>閉じる</Button>}>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1"><Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・タグで検索" className="field-input pl-8 text-xs" /></div>
          <select value={kind} onChange={(event) => setKind(event.target.value as 'all' | AssetKind)} className="field-input w-32 cursor-pointer text-xs">{(Object.keys(KIND_LABEL) as ('all' | AssetKind)[]).map((item) => <option key={item} value={item}>{KIND_LABEL[item]}</option>)}</select>
          <label className="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 text-xs"><input type="checkbox" checked={unusedOnly} onChange={(event) => setUnusedOnly(event.target.checked)} className="accent-brand" />未使用のみ</label>
        </div>
        <div className="flex justify-between text-[11px] text-ink-400"><span>{filtered.length}件を表示</span><span>重複候補 {duplicates.size}件</span></div>
        {filtered.length === 0 ? <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-ink-700 text-sm text-ink-400">条件に合う素材はありません</div> : (
          <ul className="grid max-h-[58vh] grid-cols-1 gap-2 overflow-y-auto pr-1 lg:grid-cols-2">
            {filtered.map((asset) => <AssetRow key={asset.id} asset={asset} usage={usage.get(asset.id) ?? []} duplicate={duplicates.has(asset.id)} onRefresh={refresh} />)}
          </ul>
        )}
      </Modal>
    </>
  )
}
