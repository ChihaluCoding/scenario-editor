import { EFFECT_OP_LABEL, type Line, type Project } from '@/types'

const STAGE_ACTION_LABEL = {
  background: '背景を変更',
  bgm: 'BGMを変更',
  se: '効果音を再生',
  character: '立ち絵を表示',
  hide: '立ち絵を非表示',
  effect: '画面効果を再生',
  wait: '待機',
} as const

/** フローの詳細表示向けに、台本行を短い説明文へ変換する */
export function describeLine(line: Line, project: Project): string {
  switch (line.kind) {
    case 'say': {
      const speaker = project.characters.find((character) => character.id === line.charId)?.name ?? '話者未設定'
      return `${speaker}：${line.text || '（空のセリフ）'}`
    }
    case 'narration':
      return line.text || '（空の地の文）'
    case 'note':
      return line.text || '（空のメモ）'
    case 'choice': {
      const options = line.options.map((option) => option.text || '（無題）').join(' / ')
      return `${line.prompt || '選択してください'}${options ? `：${options}` : ''}`
    }
    case 'jump': {
      const destination = project.scenes.find((scene) => scene.id === line.next)?.title ?? '移動先未設定'
      return `「${destination}」へ移動`
    }
    case 'set':
      return line.effects.length === 0
        ? '操作未設定'
        : line.effects.map((effect) => {
          const variable = project.variables.find((item) => item.id === effect.varId)?.name ?? '変数未設定'
          return `${variable} ${EFFECT_OP_LABEL[effect.op]} ${String(effect.value)}`
        }).join('、')
    case 'stage':
      return line.action === 'wait'
        ? `${STAGE_ACTION_LABEL[line.action]}（${line.duration}ms）`
        : STAGE_ACTION_LABEL[line.action]
  }
}
