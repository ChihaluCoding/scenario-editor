import { nanoid } from 'nanoid'
import {
  PALETTE,
  type Character,
  type Condition,
  type ConditionGroup,
  type Effect,
  type Line,
  type LineKind,
  type Project,
  type Scene,
  type VarType,
  type Variable,
} from '@/types'
import { defaultValueFor } from './vars'

export const newCharacter = (name: string, index: number): Character => ({
  id: nanoid(8),
  name,
  color: PALETTE[index % PALETTE.length],
  avatar: '',
  portraits: [],
  note: '',
})

export const newVariable = (name: string, type: VarType = 'number'): Variable => ({
  id: nanoid(8),
  name,
  type,
  initial: defaultValueFor(type),
  note: '',
})

export const newCondition = (varId: string, type: VarType): Condition => ({
  id: nanoid(6),
  varId,
  op: type === 'number' ? '>=' : '==',
  value: defaultValueFor(type),
})

/** 最初の変数を使った条件グループ。行・選択肢の「条件を追加」から使う */
export const initialConditionGroup = (variables: Variable[]): ConditionGroup => ({
  mode: 'all',
  items: [newCondition(variables[0].id, variables[0].type)],
})

export const newEffect = (varId: string, type: VarType): Effect => ({
  id: nanoid(6),
  varId,
  op: type === 'number' ? 'add' : type === 'boolean' ? 'set' : 'set',
  value: type === 'number' ? 1 : type === 'boolean' ? true : '',
})

export const newScene = (title: string, pos = { x: 0, y: 0 }): Scene => ({
  id: nanoid(8),
  title,
  summary: '',
  bg: '',
  bgm: '',
  chapter: '未分類',
  tags: [],
  status: 'draft',
  ending: null,
  pos,
  lines: [],
})

export function newLine(kind: LineKind): Line {
  const id = nanoid(8)
  switch (kind) {
    case 'say':
      return { id, kind, charId: '', text: '', voice: '' }
    case 'choice':
      return {
        id,
        kind,
        prompt: '',
        options: [
          { id: nanoid(6), text: '', next: '', whenLocked: 'hide', effects: [] },
          { id: nanoid(6), text: '', next: '', whenLocked: 'hide', effects: [] },
        ],
      }
    case 'jump':
      return { id, kind, next: '' }
    case 'set':
      return { id, kind, effects: [] }
    case 'stage':
      return {
        id,
        kind,
        action: 'background',
        asset: '',
        charId: '',
        portraitId: '',
        position: 'center',
        transition: 'fade',
        screenEffect: 'shake',
        duration: 500,
      }
    default:
      return { id, kind, text: '' }
  }
}

export function blankProject(title = '無題のシナリオ'): Project {
  const scene = newScene('オープニング', { x: 0, y: 0 })
  return {
    version: 5,
    id: `p_${nanoid(10)}`,
    title,
    author: '',
    characters: [],
    variables: [],
    templates: [],
    variablePresets: [],
    scenes: [scene],
    startSceneId: scene.id,
  }
}
