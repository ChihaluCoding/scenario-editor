import type { Project } from '@/types'

export interface CharacterProductionStats {
  characterId: string
  name: string
  lines: number
  characters: number
  scenes: number
  longLines: number
  repeatedEndings: number
}

const sentenceEnding = (text: string) => text.trim().replace(/[。！？!?…・]+$/u, '').slice(-3)

/** キャラクターごとの執筆量と、確認したい口調上の傾向を集計する。 */
export function characterProductionStats(project: Project): CharacterProductionStats[] {
  return project.characters.map((character) => {
    const lines = project.scenes.flatMap((scene) =>
      scene.lines
        .filter((line) => line.kind === 'say' && line.charId === character.id)
        .map((line) => ({ sceneId: scene.id, text: line.kind === 'say' ? line.text : '' })),
    )
    let repeatedEndings = 0
    let previous = ''
    let streak = 0
    for (const line of lines) {
      const ending = sentenceEnding(line.text)
      streak = ending && ending === previous ? streak + 1 : 1
      if (streak >= 3) repeatedEndings += 1
      previous = ending
    }
    return {
      characterId: character.id,
      name: character.name,
      lines: lines.length,
      characters: lines.reduce((total, line) => total + line.text.length, 0),
      scenes: new Set(lines.map((line) => line.sceneId)).size,
      longLines: lines.filter((line) => line.text.length > 120).length,
      repeatedEndings,
    }
  })
}

export function productionProgress(project: Project) {
  const done = project.scenes.filter((scene) => scene.status === 'done').length
  return { done, total: project.scenes.length, ratio: project.scenes.length ? done / project.scenes.length : 1 }
}

