import { z } from 'zod'

/** シナリオデータのスキーマ。インポート時の検証とマイグレーションに使う。 */

/* ---------------- 変数・条件・効果 ---------------- */

export const varValueSchema = z.union([z.number(), z.boolean(), z.string()])
export const varTypeSchema = z.enum(['number', 'boolean', 'string'])

export const variableSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: varTypeSchema,
  initial: varValueSchema,
  note: z.string().default(''),
})

export const COMPARE_OPS = ['==', '!=', '>', '>=', '<', '<='] as const
export const EFFECT_OPS = ['set', 'add', 'sub', 'toggle'] as const

export const conditionSchema = z.object({
  id: z.string(),
  varId: z.string(),
  op: z.enum(COMPARE_OPS),
  value: varValueSchema,
})

export const conditionGroupSchema = z.object({
  mode: z.enum(['all', 'any']).default('all'),
  items: z.array(conditionSchema).default([]),
})

export const effectSchema = z.object({
  id: z.string(),
  varId: z.string(),
  op: z.enum(EFFECT_OPS),
  value: varValueSchema,
})

/* ---------------- キャラクター ---------------- */

export const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  /** 画像 URL、または `asset:<id>` 形式のアセット参照 */
  avatar: z.string().default(''),
  portraits: z.array(z.object({ id: z.string(), name: z.string(), asset: z.string().default('') })).default([]),
  note: z.string().default(''),
})

/* ---------------- 行 ---------------- */

/** すべての行が持つ共通フィールド。`cond` を満たさない行は再生時にスキップされる。 */
const base = {
  id: z.string(),
  cond: conditionGroupSchema.optional(),
  /** 制作用。ゲーム本編には影響しない。 */
  todo: z.string().optional(),
  bookmarked: z.boolean().optional(),
}

export const choiceOptionSchema = z.object({
  id: z.string(),
  text: z.string().default(''),
  next: z.string().default(''),
  cond: conditionGroupSchema.optional(),
  /** 条件を満たさないときの見せ方 */
  whenLocked: z.enum(['hide', 'disable']).default('hide'),
  effects: z.array(effectSchema).default([]),
})

export const lineSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('say'), charId: z.string().default(''), text: z.string().default(''), voice: z.string().default(''), portraitId: z.string().optional(), position: z.enum(['left', 'center', 'right']).optional() }),
  z.object({ ...base, kind: z.literal('narration'), text: z.string().default('') }),
  z.object({ ...base, kind: z.literal('note'), text: z.string().default('') }),
  z.object({ ...base, kind: z.literal('jump'), next: z.string().default('') }),
  z.object({ ...base, kind: z.literal('set'), effects: z.array(effectSchema).default([]) }),
  z.object({
    ...base,
    kind: z.literal('stage'),
    action: z.enum(['background', 'bgm', 'se', 'character', 'hide', 'effect', 'wait']).default('background'),
    asset: z.string().default(''),
    charId: z.string().default(''),
    portraitId: z.string().default(''),
    position: z.enum(['left', 'center', 'right']).default('center'),
    transition: z.enum(['cut', 'fade']).default('fade'),
    screenEffect: z.enum(['shake', 'flash', 'dim']).default('shake'),
    duration: z.number().min(0).default(500),
  }),
  z.object({
    ...base,
    kind: z.literal('choice'),
    prompt: z.string().default(''),
    options: z.array(choiceOptionSchema).default([]),
  }),
])

/* ---------------- シーン・プロジェクト ---------------- */

export const SCENE_STATUSES = ['draft', 'writing', 'review', 'done'] as const
export const ENDING_TYPES = ['normal', 'good', 'bad', 'true'] as const
export const sceneStatusSchema = z.enum(SCENE_STATUSES)
export const endingTypeSchema = z.enum(ENDING_TYPES)

export const sceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().default(''),
  /** 画像 URL、または `asset:<id>` */
  bg: z.string().default(''),
  /** 音声 URL、または `asset:<id>` */
  bgm: z.string().default(''),
  chapter: z.string().default('未分類'),
  tags: z.array(z.string()).default([]),
  status: sceneStatusSchema.default('draft'),
  ending: endingTypeSchema.nullable().default(null),
  pos: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  lines: z.array(lineSchema).default([]),
})

export const sceneTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  lines: z.array(lineSchema).default([]),
})

export const variablePresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  values: z.record(z.string(), varValueSchema),
})

export const projectSchema = z.object({
  version: z.number().default(5).transform(() => 5),
  id: z.string().default(() => `p_${Math.random().toString(36).slice(2, 10)}`),
  title: z.string().default('無題のシナリオ'),
  author: z.string().default(''),
  characters: z.array(characterSchema).default([]),
  variables: z.array(variableSchema).default([]),
  templates: z.array(sceneTemplateSchema).default([]),
  variablePresets: z.array(variablePresetSchema).default([]),
  scenes: z.array(sceneSchema).min(1),
  startSceneId: z.string(),
})

/** 書き出しファイル。アセットの実体を data URL で同梱できる。 */
export const projectFileSchema = projectSchema.extend({
  assets: z
    .array(z.object({ id: z.string(), name: z.string(), type: z.string(), dataUrl: z.string(), tags: z.array(z.string()).optional() }))
    .optional(),
})

export type VarValue = z.infer<typeof varValueSchema>
export type VarType = z.infer<typeof varTypeSchema>
export type Variable = z.infer<typeof variableSchema>
export type Condition = z.infer<typeof conditionSchema>
export type ConditionGroup = z.infer<typeof conditionGroupSchema>
export type Effect = z.infer<typeof effectSchema>
export type CompareOp = (typeof COMPARE_OPS)[number]
export type EffectOp = (typeof EFFECT_OPS)[number]
export type Character = z.infer<typeof characterSchema>
export type Line = z.infer<typeof lineSchema>
export type LineKind = Line['kind']
export type ChoiceLine = Extract<Line, { kind: 'choice' }>
export type ChoiceOption = z.infer<typeof choiceOptionSchema>
export type Scene = z.infer<typeof sceneSchema>
export type SceneStatus = z.infer<typeof sceneStatusSchema>
export type EndingType = z.infer<typeof endingTypeSchema>
export type SceneTemplate = z.infer<typeof sceneTemplateSchema>
export type VariablePreset = z.infer<typeof variablePresetSchema>
export type Project = z.infer<typeof projectSchema>
export type ProjectFile = z.infer<typeof projectFileSchema>

export const LINE_META: Record<LineKind, { label: string; accent: string; hint: string }> = {
  say: { label: 'セリフ', accent: 'var(--color-line-say)', hint: 'キャラクターの発話' },
  narration: { label: '地の文', accent: 'var(--color-line-narration)', hint: '状況描写・モノローグ' },
  choice: { label: '選択肢', accent: 'var(--color-line-choice)', hint: 'プレイヤーに分岐を提示' },
  jump: { label: 'ジャンプ', accent: 'var(--color-line-jump)', hint: '指定シーンへ移動（条件付きにもできる）' },
  set: { label: '変数操作', accent: 'var(--color-line-set)', hint: '好感度やフラグを変更する' },
  note: { label: 'メモ', accent: 'var(--color-line-note)', hint: '制作用。本編には出ない' },
  stage: { label: '演出', accent: 'var(--color-line-stage)', hint: '背景・音・立ち絵・画面効果を変更する' },
}

export const EFFECT_OP_LABEL: Record<EffectOp, string> = {
  set: '＝ 代入',
  add: '＋ 加算',
  sub: '－ 減算',
  toggle: '⇄ 反転',
}

export const PALETTE = ['#6ea8ff', '#ff9ecd', '#5ed6a4', '#ffb86e', '#b57edc', '#78dce8', '#ffd866', '#ff6e78']

export const SCENE_STATUS_LABEL: Record<SceneStatus, string> = {
  draft: '下書き',
  writing: '執筆中',
  review: '確認待ち',
  done: '完成',
}

export const ENDING_TYPE_LABEL: Record<EndingType, string> = {
  normal: 'NORMAL',
  good: 'GOOD',
  bad: 'BAD',
  true: 'TRUE',
}
