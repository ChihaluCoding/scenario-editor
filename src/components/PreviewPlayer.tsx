import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { nanoid } from 'nanoid'
import { Bug, CornerUpLeft, History, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useProject } from '@/store/project'
import { useAssetUrl } from '@/lib/assets'
import { applyEffects, coerce, evalConditions, initialVars, type VarState } from '@/lib/vars'
import { runPreview, type Runtime, type StageCharacter, type StagePosition, type StageState } from '@/lib/previewRuntime'
import type { Character, ChoiceOption } from '@/types'
import { Button, IconButton } from './ui'
import { toast } from './toast'
import { useAppDialog } from './dialogs/appDialogContext'

const TYPE_SPEED_MS = 22
const POSITIONS: StagePosition[] = ['left', 'center', 'right']

interface LogItem { name: string; text: string }
interface SavedState { id: string; name: string; runtime: Runtime; log: LogItem[] }
interface ChoiceSnapshot { runtime: Runtime; log: LogItem[] }

function portraitRef(character: Character | undefined, portraitId: string) {
  return character?.portraits.find((portrait) => portrait.id === portraitId)?.asset || character?.avatar || ''
}

function StagePortrait({ entry, position, characters }: { entry?: StageCharacter; position: StagePosition; characters: Character[] }) {
  const character = entry ? characters.find((item) => item.id === entry.charId) : undefined
  const url = useAssetUrl(portraitRef(character, entry?.portraitId ?? ''))
  if (!url) return null
  return (
    <img
      src={url}
      alt={character?.name ?? ''}
      className={clsx(
        'pointer-events-none absolute bottom-0 z-[2] max-h-[78%] max-w-[42%] object-contain drop-shadow-2xl transition-[transform,opacity,filter] duration-300',
        position === 'left' && 'left-[18%] -translate-x-1/2',
        position === 'center' && 'left-1/2 -translate-x-1/2',
        position === 'right' && 'right-[18%] translate-x-1/2',
      )}
    />
  )
}

export function PreviewPlayer({ onClose }: { onClose: () => void }) {
  const project = useProject((state) => state.project)
  const selectedSceneId = useProject((state) => state.selectedSceneId)
  const edit = useProject((state) => state.edit)
  const [runtime, setRuntime] = useState<Runtime>(() =>
    runPreview(project, { sceneId: project.startSceneId, index: 0 }, initialVars(project.variables)),
  )
  const [typed, setTyped] = useState('')
  const [log, setLog] = useState<LogItem[]>([])
  const [panel, setPanel] = useState<'none' | 'log' | 'vars'>('none')
  const [saves, setSaves] = useState<SavedState[]>([])
  const [choiceHistory, setChoiceHistory] = useState<ChoiceSnapshot[]>([])
  const { promptText } = useAppDialog()

  const { frame, vars } = runtime
  const { stage } = frame
  const typing = typed.length < frame.text.length
  const bgUrl = useAssetUrl(stage.bg)
  const bgmUrl = useAssetUrl(stage.bgm)
  const seUrl = useAssetUrl(stage.se)

  /* タイプライター演出 */
  useEffect(() => {
    setTyped('')
    if (!frame.text) return
    let index = 0
    const timer = setInterval(() => {
      index += 1
      setTyped(frame.text.slice(0, index))
      if (index >= frame.text.length) clearInterval(timer)
    }, TYPE_SPEED_MS)
    return () => clearInterval(timer)
  }, [frame.text, frame.cursor.sceneId, frame.cursor.index])

  /* バックログ */
  const lastLogged = useRef('')
  useEffect(() => {
    if (frame.kind !== 'say' && frame.kind !== 'narration') return
    const key = `${frame.cursor.sceneId}:${frame.cursor.index}`
    if (lastLogged.current === key) return
    lastLogged.current = key
    setLog((current) => [...current, { name: frame.speaker?.name ?? '', text: frame.text }])
  }, [frame])

  /* BGM・効果音 */
  const bgmRef = useRef<HTMLAudioElement>(null)
  const seRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = bgmRef.current
    if (!audio) return
    if (!bgmUrl) {
      audio.pause()
      return
    }
    if (audio.src !== bgmUrl) audio.src = bgmUrl
    audio.loop = true
    audio.volume = 0.5
    void audio.play().catch(() => {})
  }, [bgmUrl])
  useEffect(() => {
    const audio = seRef.current
    if (!audio || !seUrl) return
    audio.src = seUrl
    audio.currentTime = 0
    void audio.play().catch(() => {})
  }, [seUrl, stage.seKey, frame.cursor.sceneId, frame.cursor.index])

  const goto = useCallback(
    (cursor: { sceneId: string; index: number }, nextVars: VarState, nextStage?: StageState) =>
      setRuntime(runPreview(project, cursor, nextVars, nextStage)),
    [project],
  )

  const advance = useCallback(() => {
    if (typing) return setTyped(frame.text)
    if (frame.kind === 'end' || frame.kind === 'choice') return
    goto({ sceneId: frame.cursor.sceneId, index: frame.cursor.index + 1 }, vars, stage)
  }, [typing, frame, vars, stage, goto])

  const choose = (option: ChoiceOption) => {
    setChoiceHistory((current) => [...current, { runtime: structuredClone(runtime), log: structuredClone(log) }].slice(-30))
    const nextVars = applyEffects(option.effects, vars, project.variables)
    if (option.next) goto({ sceneId: option.next, index: 0 }, nextVars)
    else goto({ sceneId: frame.cursor.sceneId, index: frame.cursor.index + 1 }, nextVars, stage)
  }

  const restart = (from: string, nextVars = initialVars(project.variables)) => {
    setLog([])
    setChoiceHistory([])
    lastLogged.current = ''
    setRuntime(runPreview(project, { sceneId: from, index: 0 }, nextVars))
  }

  const backToChoice = () => {
    const previous = choiceHistory.at(-1)
    if (!previous) return
    setRuntime(previous.runtime)
    setLog(previous.log)
    setTyped('')
    setChoiceHistory((current) => current.slice(0, -1))
  }

  const saveSession = () => {
    const saved: SavedState = { id: nanoid(7), name: `セーブ ${saves.length + 1}`, runtime: structuredClone(runtime), log: structuredClone(log) }
    setSaves((current) => [...current, saved])
    setPanel('vars')
    toast(`${saved.name}を作成しました`)
  }

  const savePreset = async () => {
    const name = await promptText({
      title: '変数プリセットを保存',
      description: '現在の変数の状態を、あとから呼び出せるプリセットとして保存します。',
      label: 'プリセット名',
      initialValue: `プリセット ${project.variablePresets.length + 1}`,
      confirmLabel: '保存',
    })
    if (!name) return
    edit((draft) => {
      draft.variablePresets.push({ id: nanoid(7), name, values: structuredClone(vars) })
    })
    toast(`「${name}」を保存しました`)
  }

  /* 待機行は指定時間後に自動で次へ進める */
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  useEffect(() => {
    if (frame.kind !== 'wait') return
    const timer = window.setTimeout(() => advanceRef.current(), frame.duration ?? 0)
    return () => window.clearTimeout(timer)
  }, [frame.kind, frame.duration, frame.cursor.sceneId, frame.cursor.index])

  /* キーボード操作 */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return panel !== 'none' ? setPanel('none') : onClose()
      if (event.key === ' ' || event.key === 'Enter') {
        const target = event.target as HTMLElement
        if (target.matches('input, select, textarea, button')) return
        event.preventDefault()
        advanceRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, panel])

  const options = (frame.choice?.options ?? []).map((option) => ({
    option,
    available: evalConditions(option.cond, vars, project.variables),
  }))

  return (
    <div className={clsx('preview-player fixed inset-0 z-60 bg-[var(--color-preview-paper)]', stage.effect?.name === 'shake' && 'stage-shake')} style={{ animationDuration: `${stage.effect?.duration ?? 0}ms` }} onClick={advance}>
      <audio ref={bgmRef} hidden />
      <audio ref={seRef} hidden />

      <div
        key={`bg-${stage.effect?.name === 'fade' ? stage.effect.key : stage.bg}`}
        className={clsx('absolute inset-0 bg-cover bg-center', stage.effect?.name === 'fade' && 'stage-fade')}
        style={bgUrl ? { backgroundImage: `url("${bgUrl.replaceAll('"', '%22')}")`, animationDuration: `${stage.effect?.duration ?? 350}ms` } : { background: 'var(--preview-backdrop)' }}
      />

      {frame.kind === 'say' && POSITIONS.map((position) => (
        <StagePortrait key={position} position={position} entry={stage.characters[position]} characters={project.characters} />
      ))}

      {stage.effect?.name === 'flash' && <div key={`flash-${stage.effect.key}`} className="stage-flash pointer-events-none absolute inset-0 z-[4] bg-[var(--color-preview-flash)]" style={{ animationDuration: `${stage.effect.duration}ms` }} />}
      {stage.effect?.name === 'dim' && <div key={`dim-${stage.effect.key}`} className="stage-dim pointer-events-none absolute inset-0 z-[4] bg-[var(--color-preview-paper)]" style={{ animationDuration: `${stage.effect.duration}ms` }} />}

      <div className="absolute top-4 right-4 z-10 flex gap-2" onClick={(event) => event.stopPropagation()}>
        {project.variables.length > 0 && <IconButton label="変数・セーブ" variant="solid" onClick={() => setPanel(panel === 'vars' ? 'none' : 'vars')}><Bug size={16} /></IconButton>}
        <IconButton label="現在の状態を保存" variant="solid" onClick={saveSession}><Save size={16} /></IconButton>
        <IconButton label="直前の選択肢へ戻る" variant="solid" disabled={choiceHistory.length === 0} onClick={backToChoice}><CornerUpLeft size={16} /></IconButton>
        <IconButton label="バックログ" variant="solid" onClick={() => setPanel('log')}><History size={16} /></IconButton>
        <IconButton label="選択中のシーンから再生し直す" variant="solid" onClick={() => restart(selectedSceneId)}><RotateCcw size={16} /></IconButton>
        <IconButton label="閉じる (Esc)" variant="solid" onClick={onClose}><X size={16} /></IconButton>
      </div>

      {panel === 'vars' && (
        <div className="absolute top-16 right-4 z-10 flex max-h-[78vh] w-80 flex-col gap-3 overflow-y-auto rounded-xl border border-ink-600 bg-ink-950/95 p-3 text-xs shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <section>
            <div className="mb-2 flex items-center justify-between font-semibold text-ink-300"><span>変数の状態</span><Button variant="ghost" size="sm" onClick={savePreset}>プリセット保存</Button></div>
            <ul className="flex flex-col gap-1.5">
              {project.variables.map((variable) => (
                <li key={variable.id} className="grid grid-cols-[1fr_8rem] items-center gap-2">
                  <span className="truncate text-ink-300">{variable.name}</span>
                  {variable.type === 'boolean' ? (
                    <select value={String(vars[variable.id] ?? variable.initial)} onChange={(event) => setRuntime((current) => ({ ...current, vars: { ...current.vars, [variable.id]: event.target.value === 'true' } }))} className="field-input py-1 text-xs"><option value="false">OFF</option><option value="true">ON</option></select>
                  ) : (
                    <input type={variable.type === 'number' ? 'number' : 'text'} value={String(vars[variable.id] ?? variable.initial)} onChange={(event) => setRuntime((current) => ({ ...current, vars: { ...current.vars, [variable.id]: coerce(variable.type, event.target.value) } }))} className="field-input py-1 text-xs" />
                  )}
                </li>
              ))}
              {project.variables.length === 0 && <li className="text-ink-400">変数はありません</li>}
            </ul>
          </section>

          {project.variablePresets.length > 0 && (
            <section className="border-t border-ink-700 pt-2">
              <div className="mb-1.5 font-semibold text-ink-300">変数プリセット</div>
              <ul className="flex flex-col gap-1">
                {project.variablePresets.map((preset) => (
                  <li key={preset.id} className="flex items-center gap-1.5">
                    <button onClick={() => restart(selectedSceneId, { ...initialVars(project.variables), ...preset.values })} className="min-w-0 flex-1 truncate rounded-md bg-ink-800 px-2 py-1.5 text-left hover:bg-ink-700">{preset.name}</button>
                    <IconButton label="プリセットを削除" variant="danger" onClick={() => edit((draft) => { draft.variablePresets = draft.variablePresets.filter((item) => item.id !== preset.id) })}><Trash2 size={12} /></IconButton>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="border-t border-ink-700 pt-2">
            <div className="mb-1.5 font-semibold text-ink-300">セッションセーブ</div>
            {saves.length === 0 ? <p className="text-ink-400">上部の保存ボタンで現在位置を記録できます。</p> : (
              <ul className="flex flex-col gap-1">
                {saves.map((saved) => (
                  <li key={saved.id} className="flex items-center gap-1.5">
                    <button onClick={() => { setRuntime(saved.runtime); setLog(saved.log); setTyped('') }} className="min-w-0 flex-1 truncate rounded-md bg-ink-800 px-2 py-1.5 text-left hover:bg-ink-700">{saved.name}</button>
                    <IconButton label="セーブを削除" variant="danger" onClick={() => setSaves((current) => current.filter((item) => item.id !== saved.id))}><Trash2 size={12} /></IconButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {frame.kind !== 'wait' && (
        <div className="absolute inset-x-[6%] bottom-[5%] z-[5] min-h-44 rounded-2xl border border-white/12 bg-ink-950/85 px-7 py-5 shadow-2xl backdrop-blur-md">
          <div className="mb-2 h-6 text-lg font-bold" style={{ color: frame.speaker?.color ?? 'var(--color-preview-ink)' }}>{frame.speaker?.name}</div>
          <p className={clsx('min-h-16 text-lg leading-loose whitespace-pre-wrap', frame.kind === 'end' && 'text-ink-300')}>
            {frame.kind === 'choice' ? frame.text : typed}
            {typing && <span className="animate-pulse">▌</span>}
          </p>

          {frame.kind === 'choice' && (
            <div className="mt-3 flex flex-col gap-2" onClick={(event) => event.stopPropagation()}>
              {options.map(({ option, available }) => !available && option.whenLocked === 'hide' ? null : (
                <button key={option.id} disabled={!available} onClick={() => choose(option)} className={clsx('rounded-lg border px-4 py-2.5 text-left text-base transition', available ? 'border-white/15 bg-ink-800/85 hover:border-brand hover:bg-brand/20' : 'cursor-not-allowed border-white/5 bg-ink-900/60 text-ink-400 line-through')}>
                  {option.text || '(無題の選択肢)'}
                </button>
              ))}
              {options.length > 0 && options.every(({ available }) => !available) && <p className="text-sm text-bad">選べる選択肢がありません（条件を見直してください）</p>}
            </div>
          )}

          <div className="absolute right-5 bottom-2 text-[11px] text-ink-400">{frame.kind === 'end' ? 'Esc で閉じる' : frame.kind === 'choice' ? '選択してください' : 'クリック / Space で進む'}</div>
        </div>
      )}

      {panel === 'log' && (
        <div className="absolute inset-0 z-20 flex flex-col bg-ink-950/95 p-8 backdrop-blur" onClick={(event) => { event.stopPropagation(); setPanel('none') }}>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">バックログ</h3><span className="text-xs text-ink-400">クリックで閉じる</span></div>
          <div className="flex flex-col gap-3 overflow-y-auto">
            {log.length === 0 && <p className="text-ink-400">まだ履歴がありません</p>}
            {log.map((item, index) => <div key={index}>{item.name && <div className="text-xs text-ink-300">{item.name}</div>}<div className="leading-relaxed">{item.text}</div></div>)}
          </div>
        </div>
      )}
    </div>
  )
}
