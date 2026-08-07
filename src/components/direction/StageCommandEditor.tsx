import { useProject } from '@/store/project'
import type { Line } from '@/types'
import { AssetInput } from '@/components/AssetInput'

type StageLine = Extract<Line, { kind: 'stage' }>

const ACTION_LABEL: Record<StageLine['action'], string> = {
  background: '背景を変更',
  bgm: 'BGMを再生・停止',
  se: '効果音を再生',
  character: 'キャラクターを表示',
  hide: 'キャラクターを非表示',
  effect: '画面効果',
  wait: '待機',
}

const POSITION_LABEL: Record<StageLine['position'], string> = { left: '左', center: '中央', right: '右' }

export function StageCommandEditor({ line, onChange }: { line: StageLine; onChange: (patch: Partial<StageLine>) => void }) {
  const characters = useProject((state) => state.project.characters)
  const character = characters.find((item) => item.id === line.charId)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line-stage/25 bg-line-stage/6 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={line.action} onChange={(event) => onChange({ action: event.target.value as StageLine['action'] })} className="field-input w-48 cursor-pointer text-[12px]">
          {(Object.keys(ACTION_LABEL) as StageLine['action'][]).map((action) => <option key={action} value={action}>{ACTION_LABEL[action]}</option>)}
        </select>
        {(line.action === 'background' || line.action === 'character') && (
          <select value={line.transition} onChange={(event) => onChange({ transition: event.target.value as StageLine['transition'] })} className="field-input w-32 cursor-pointer text-[12px]">
            <option value="fade">フェード</option>
            <option value="cut">即時切替</option>
          </select>
        )}
      </div>

      {line.action === 'background' && <AssetInput value={line.asset} onChange={(asset) => onChange({ asset })} accept="image/*" placeholder="背景画像を指定" />}
      {line.action === 'bgm' && <AssetInput value={line.asset} onChange={(asset) => onChange({ asset })} accept="audio/*" preview="audio" placeholder="空欄にするとBGM停止" />}
      {line.action === 'se' && <AssetInput value={line.asset} onChange={(asset) => onChange({ asset })} accept="audio/*" preview="audio" placeholder="効果音を指定" />}

      {line.action === 'character' && (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_7rem]">
          <select value={line.charId} onChange={(event) => onChange({ charId: event.target.value, portraitId: '' })} className="field-input cursor-pointer text-[12px]">
            <option value="">キャラクターを選択</option>
            {characters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={line.portraitId} onChange={(event) => onChange({ portraitId: event.target.value })} className="field-input cursor-pointer text-[12px]">
            <option value="">通常立ち絵</option>
            {character?.portraits.map((portrait) => <option key={portrait.id} value={portrait.id}>{portrait.name}</option>)}
          </select>
          <select value={line.position} onChange={(event) => onChange({ position: event.target.value as StageLine['position'] })} className="field-input cursor-pointer text-[12px]">
            {(Object.keys(POSITION_LABEL) as StageLine['position'][]).map((position) => <option key={position} value={position}>{POSITION_LABEL[position]}</option>)}
          </select>
        </div>
      )}

      {line.action === 'hide' && (
        <select value={line.position} onChange={(event) => onChange({ position: event.target.value as StageLine['position'] })} className="field-input w-40 cursor-pointer text-[12px]">
          {(Object.keys(POSITION_LABEL) as StageLine['position'][]).map((position) => <option key={position} value={position}>{POSITION_LABEL[position]}を非表示</option>)}
        </select>
      )}

      {line.action === 'effect' && (
        <div className="flex items-center gap-2">
          <select value={line.screenEffect} onChange={(event) => onChange({ screenEffect: event.target.value as StageLine['screenEffect'] })} className="field-input w-44 cursor-pointer text-[12px]">
            <option value="shake">画面を揺らす</option>
            <option value="flash">白くフラッシュ</option>
            <option value="dim">暗転</option>
          </select>
          <DurationInput value={line.duration} onChange={(duration) => onChange({ duration })} />
        </div>
      )}

      {line.action === 'wait' && <DurationInput value={line.duration} onChange={(duration) => onChange({ duration })} />}
    </div>
  )
}

function DurationInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-400">
      時間
      <input type="number" min={0} step={100} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} className="field-input w-24 text-[12px]" />
      ms
    </label>
  )
}
