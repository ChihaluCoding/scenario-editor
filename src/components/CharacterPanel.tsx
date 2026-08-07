import { useState } from 'react'
import { nanoid } from 'nanoid'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { useProject } from '@/store/project'
import { PALETTE, type Character } from '@/types'
import { Button, Field, IconButton, Modal, PanelHeading } from './ui'
import { toast } from './toast'
import { AssetInput } from './AssetInput'
import { useAssetUrl } from '@/lib/assets'
import { useAppDialog } from './dialogs/appDialogContext'

function Avatar({ character }: { character: Character }) {
  const url = useAssetUrl(character.avatar)
  if (url) return <img src={url} alt="" className="size-6 shrink-0 rounded-full object-cover" />
  return (
    <span
      className="grid size-6 shrink-0 place-items-center rounded-full text-ink-100"
      style={{ background: character.color }}
    >
      <UserRound size={13} />
    </span>
  )
}

function CharacterEditor({ character, onClose }: { character: Character; onClose: () => void }) {
  const update = useProject((s) => s.updateCharacter)
  return (
    <Modal open title="キャラクター設定" onClose={onClose} className="max-w-2xl" footer={<Button variant="primary" onClick={onClose}>閉じる</Button>}>
      <Field label="名前">
        <input
          className="field-input"
          value={character.name}
          onChange={(e) => update(character.id, { name: e.target.value })}
          autoFocus
        />
      </Field>

      <Field label="テーマカラー">
        <div className="flex flex-wrap items-center gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => update(character.id, { color: c })}
              style={{ background: c }}
              className={`size-6 rounded-full transition ${character.color === c ? 'ring-2 ring-ink-100 ring-offset-2 ring-offset-ink-850' : ''}`}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={character.color}
            onChange={(e) => update(character.id, { color: e.target.value })}
            className="ml-1 size-6 cursor-pointer rounded border border-ink-700 bg-transparent"
          />
        </div>
      </Field>

      <Field label="立ち絵（プレビューに表示されます）">
        <AssetInput
          value={character.avatar}
          onChange={(avatar) => update(character.id, { avatar })}
          accept="image/*"
        />
      </Field>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-ink-400">立ち絵・表情差分</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update(character.id, { portraits: [...character.portraits, { id: nanoid(7), name: `表情 ${character.portraits.length + 1}`, asset: '' }] })}
          >
            <Plus size={13} />追加
          </Button>
        </div>
        {character.portraits.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-700 py-4 text-center text-xs text-ink-400">笑顔・怒り・衣装差分などを追加できます</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {character.portraits.map((portrait) => (
              <div key={portrait.id} className="rounded-lg border border-ink-700 p-2">
                <div className="mb-2 flex items-center gap-2">
                  <input value={portrait.name} onChange={(event) => update(character.id, { portraits: character.portraits.map((item) => item.id === portrait.id ? { ...item, name: event.target.value } : item) })} placeholder="差分名" className="field-input text-[12px]" />
                  <IconButton size="sm" label="差分を削除" variant="danger" onClick={() => update(character.id, { portraits: character.portraits.filter((item) => item.id !== portrait.id) })}><Trash2 size={12} /></IconButton>
                </div>
                <AssetInput value={portrait.asset} onChange={(asset) => update(character.id, { portraits: character.portraits.map((item) => item.id === portrait.id ? { ...item, asset } : item) })} accept="image/*" />
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="設定メモ">
        <textarea
          className="field-input min-h-20 resize-y leading-relaxed"
          placeholder="口調、一人称、背景設定など"
          value={character.note}
          onChange={(e) => update(character.id, { note: e.target.value })}
        />
      </Field>
    </Modal>
  )
}

export function CharacterPanel() {
  const characters = useProject((s) => s.project.characters)
  const addCharacter = useProject((s) => s.addCharacter)
  const removeCharacter = useProject((s) => s.removeCharacter)
  const [editing, setEditing] = useState<string | null>(null)
  const { confirmAction } = useAppDialog()
  const target = characters.find((c) => c.id === editing)

  return (
    <section>
      <PanelHeading
        action={
          <IconButton
            size="sm"
            label="キャラクターを追加"
            variant="ghost"
            onClick={() => {
              addCharacter(`キャラクター ${characters.length + 1}`)
              toast('キャラクターを追加しました。クリックで設定を編集できます')
            }}
          >
            <Plus size={14} />
          </IconButton>
        }
      >
        キャラクター ({characters.length})
      </PanelHeading>

      {characters.length === 0 && <p className="px-1 text-xs text-ink-400">＋ から登場人物を追加します</p>}

      <ul className="flex flex-col gap-0.5">
        {characters.map((c) => (
          <li key={c.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-ink-800">
            <button onClick={() => setEditing(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <Avatar character={c} />
              <span className="truncate text-ink-300">{c.name}</span>
            </button>
            <IconButton
              size="sm"
              label="削除"
              variant="danger"
              className="context-actions opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={async () => {
                const accepted = await confirmAction({
                  title: `「${c.name}」を削除しますか？`,
                  description: 'このキャラクターを削除すると、セリフの話者設定が外れます。',
                  confirmLabel: '削除',
                  tone: 'danger',
                })
                if (accepted) removeCharacter(c.id)
              }}
            >
              <Trash2 size={12} />
            </IconButton>
          </li>
        ))}
      </ul>

      {target && <CharacterEditor character={target} onClose={() => setEditing(null)} />}
    </section>
  )
}
