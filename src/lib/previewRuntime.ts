import { ENDING_TYPE_LABEL, type Character, type ChoiceLine, type Project } from '@/types'
import { applyEffects, evalConditions, initialVars, type VarState } from '@/lib/vars'

export type StagePosition = 'left' | 'center' | 'right'

export interface Cursor {
  sceneId: string
  index: number
}

export interface StageCharacter {
  charId: string
  portraitId: string
}

export interface StageState {
  bg: string
  bgm: string
  se: string
  seKey: number
  effectKey: number
  characters: Partial<Record<StagePosition, StageCharacter>>
  effect?: { name: 'shake' | 'flash' | 'dim' | 'fade'; duration: number; key: number }
}

export interface Frame {
  kind: 'say' | 'narration' | 'choice' | 'end' | 'wait'
  speaker?: Character
  text: string
  choice?: ChoiceLine
  cursor: Cursor
  stage: StageState
  duration?: number
}

export interface Runtime {
  frame: Frame
  vars: VarState
}

const sceneStage = (project: Project, sceneId: string): StageState => {
  const scene = project.scenes.find((item) => item.id === sceneId)
  return { bg: scene?.bg ?? '', bgm: scene?.bgm ?? '', se: '', seKey: 0, effectKey: 0, characters: {} }
}

const cloneStage = (stage: StageState): StageState => ({ ...stage, characters: { ...stage.characters } })

/** 指定カーソルから、次に画面へ表示するフレームまで演出と変数を進める。 */
export function runPreview(project: Project, start: Cursor, startVars: VarState, startStage?: StageState): Runtime {
  let { sceneId, index } = start
  let vars = startVars
  let activeSceneId = sceneId
  let stage = startStage ? { ...cloneStage(startStage), se: '', effect: undefined } : sceneStage(project, sceneId)
  const sceneOf = (id: string) => project.scenes.find((scene) => scene.id === id)
  const frame = (kind: Frame['kind'], text: string, cursor: Cursor, extra: Partial<Frame> = {}): Runtime => ({
    frame: { kind, text, cursor, stage: cloneStage(stage), ...extra },
    vars,
  })

  for (let guard = 0; guard < 10000; guard++) {
    const scene = sceneOf(sceneId)
    if (!scene) return frame('end', 'シーンが見つかりません', { sceneId, index })
    if (sceneId !== activeSceneId) {
      activeSceneId = sceneId
      stage = sceneStage(project, sceneId)
    }

    if (index >= scene.lines.length) {
      if (scene.ending) return frame('end', `― ${ENDING_TYPE_LABEL[scene.ending]} END ―`, { sceneId, index })
      const next = project.scenes[project.scenes.indexOf(scene) + 1]
      if (!next) return frame('end', '― 完 ―', { sceneId, index })
      sceneId = next.id
      index = 0
      continue
    }

    const line = scene.lines[index]
    const cursor = { sceneId, index }
    if (!evalConditions(line.cond, vars, project.variables)) {
      index += 1
      continue
    }

    switch (line.kind) {
      case 'note':
        index += 1
        continue
      case 'set':
        vars = applyEffects(line.effects, vars, project.variables)
        index += 1
        continue
      case 'jump':
        if (!line.next) return frame('end', '― 完 ―', cursor)
        sceneId = line.next
        index = 0
        continue
      case 'stage': {
        if (line.action === 'background') {
          stage.bg = line.asset
          if (line.transition === 'fade') {
            stage.effectKey += 1
            stage.effect = { name: 'fade', duration: Math.max(100, line.duration), key: stage.effectKey }
          }
        } else if (line.action === 'bgm') {
          stage.bgm = line.asset
        } else if (line.action === 'se') {
          stage.se = line.asset
          stage.seKey += 1
        } else if (line.action === 'character' && line.charId) {
          stage.characters[line.position] = { charId: line.charId, portraitId: line.portraitId }
          if (line.transition === 'fade') {
            stage.effectKey += 1
            stage.effect = { name: 'fade', duration: 350, key: stage.effectKey }
          }
        } else if (line.action === 'hide') {
          delete stage.characters[line.position]
        } else if (line.action === 'effect') {
          stage.effectKey += 1
          stage.effect = { name: line.screenEffect, duration: Math.max(100, line.duration), key: stage.effectKey }
        } else if (line.action === 'wait') {
          return frame('wait', '', cursor, { duration: line.duration })
        }
        index += 1
        continue
      }
      case 'say': {
        const speaker = project.characters.find((character) => character.id === line.charId)
        if (speaker) stage.characters[line.position ?? 'center'] = { charId: speaker.id, portraitId: line.portraitId ?? '' }
        return frame('say', line.text, cursor, { speaker })
      }
      case 'narration':
        return frame('narration', line.text, cursor)
      case 'choice':
        return frame('choice', line.prompt, cursor, { choice: line })
    }
  }
  return frame('end', '進行が循環しています（条件付きジャンプを見直してください）', { sceneId, index })
}

export const initialRuntime = (project: Project): Runtime =>
  runPreview(project, { sceneId: project.startSceneId, index: 0 }, initialVars(project.variables))
