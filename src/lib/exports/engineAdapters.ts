import type { ConditionGroup, Effect, Line, Project, VarValue } from '@/types'

const identifier = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_') || 'item'
const quoted = (value: string) => JSON.stringify(value)
const pyValue = (value: VarValue) => typeof value === 'string' ? quoted(value) : value === true ? 'True' : value === false ? 'False' : String(value)

const variableName = (id: string) => `v_${identifier(id)}`
const conditionExpression = (group: ConditionGroup | undefined) => {
  if (!group?.items.length) return ''
  const joiner = group.mode === 'all' ? ' and ' : ' or '
  return group.items.map((condition) => `${variableName(condition.varId)} ${condition.op} ${pyValue(condition.value)}`).join(joiner)
}

const effectLines = (effects: Effect[], indent: string) => effects.map((effect) => {
  const name = variableName(effect.varId)
  if (effect.op === 'set') return `${indent}$ ${name} = ${pyValue(effect.value)}`
  if (effect.op === 'add') return `${indent}$ ${name} += ${pyValue(effect.value)}`
  if (effect.op === 'sub') return `${indent}$ ${name} -= ${pyValue(effect.value)}`
  return `${indent}$ ${name} = not ${name}`
})

function renpyCommand(line: Line, project: Project, indent = '    '): string[] {
  const condition = conditionExpression(line.cond)
  const inner = condition ? `${indent}    ` : indent
  const out = condition ? [`${indent}if ${condition}:`] : []
  if (line.kind === 'say') {
    const speaker = project.characters.find((character) => character.id === line.charId)
    out.push(`${inner}${speaker ? `c_${identifier(speaker.id)} ` : ''}${quoted(line.text)}`)
  } else if (line.kind === 'narration') out.push(`${inner}${quoted(line.text)}`)
  else if (line.kind === 'note') out.push(`${inner}# ${line.text.replaceAll('\n', ' ')}`)
  else if (line.kind === 'jump') out.push(`${inner}${line.next ? `jump scene_${identifier(line.next)}` : 'return'}`)
  else if (line.kind === 'set') out.push(...effectLines(line.effects, inner))
  else if (line.kind === 'stage') {
    if (line.action === 'background') out.push(`${inner}scene expression ${quoted(line.asset)}${line.transition === 'fade' ? ' with fade' : ''}`)
    else if (line.action === 'bgm') out.push(`${inner}${line.asset ? `play music ${quoted(line.asset)}` : 'stop music'}`)
    else if (line.action === 'se') out.push(`${inner}play sound ${quoted(line.asset)}`)
    else if (line.action === 'character') {
      const character = project.characters.find((item) => item.id === line.charId)
      const asset = character?.portraits.find((portrait) => portrait.id === line.portraitId)?.asset || character?.avatar || ''
      out.push(`${inner}$ renpy.show(${quoted(`char_${line.charId}`)}, what=Image(${quoted(asset)}), at_list=[${line.position}])`)
    } else if (line.action === 'hide') out.push(`${inner}hide char_${line.position}`)
    else if (line.action === 'effect') out.push(`${inner}${line.screenEffect === 'shake' ? 'with hpunch' : line.screenEffect === 'flash' ? 'with Fade(0.05, 0.1, 0.2, color="#fff")' : 'with fade'}`)
    else if (line.action === 'wait') out.push(`${inner}pause ${line.duration / 1000}`)
  } else if (line.kind === 'choice') {
    out.push(`${inner}menu:`)
    if (line.prompt) out.push(`${inner}    ${quoted(line.prompt)}`)
    for (const option of line.options) {
      const optionCondition = conditionExpression(option.cond)
      out.push(`${inner}    ${quoted(option.text || '(無題)')}${optionCondition ? ` if ${optionCondition}` : ''}:`)
      out.push(...effectLines(option.effects, `${inner}        `))
      out.push(`${inner}        ${option.next ? `jump scene_${identifier(option.next)}` : 'pass'}`)
    }
  }
  if (out.length === 0 || (condition && out.length === 1)) out.push(`${inner}pass`)
  return out
}

export function generateRenPy(project: Project): string {
  const out = [`# ${project.title} / Scenario Editor`, '']
  for (const variable of project.variables) out.push(`default ${variableName(variable.id)} = ${pyValue(variable.initial)}`)
  if (project.variables.length) out.push('')
  for (const character of project.characters) out.push(`define c_${identifier(character.id)} = Character(${quoted(character.name)}, color=${quoted(character.color)})`)
  out.push('')
  for (const scene of project.scenes) {
    out.push(`label scene_${identifier(scene.id)}:`, `    # ${scene.title}`)
    for (const line of scene.lines) out.push(...renpyCommand(line, project))
    if (scene.ending || scene === project.scenes.at(-1)) out.push('    return')
    else out.push(`    jump scene_${identifier(project.scenes[project.scenes.indexOf(scene) + 1].id)}`)
    out.push('')
  }
  return out.join('\n')
}

const tyranoAsset = (value: string) => value.replace(/^asset:/, '')

export function generateTyranoScript(project: Project): string {
  const out = [`; ${project.title} / Scenario Editor`, '']
  for (const scene of project.scenes) {
    out.push(`*scene_${identifier(scene.id)}`, `; ${scene.title}`)
    for (const line of scene.lines) {
      if (line.cond?.items.length) out.push(`; 条件: ${conditionExpression(line.cond)}`)
      if (line.kind === 'say') {
        const speaker = project.characters.find((character) => character.id === line.charId)?.name ?? ''
        if (speaker) out.push(`#${speaker}`)
        out.push(`${line.text}[p]`)
      } else if (line.kind === 'narration') out.push(`${line.text}[p]`)
      else if (line.kind === 'note') out.push(`; ${line.text.replaceAll('\n', ' ')}`)
      else if (line.kind === 'jump') out.push(line.next ? `[jump target="*scene_${identifier(line.next)}"]` : '[s]')
      else if (line.kind === 'set') out.push(...line.effects.map((effect) => `; 変数操作 ${variableName(effect.varId)} ${effect.op} ${String(effect.value)}`))
      else if (line.kind === 'choice') {
        if (line.prompt) out.push(`${line.prompt}[r]`)
        for (const option of line.options) out.push(`[glink text=${quoted(option.text)} target="*scene_${identifier(option.next || scene.id)}"]`)
        out.push('[s]')
      } else if (line.kind === 'stage') {
        if (line.action === 'background') out.push(`[bg storage=${quoted(tyranoAsset(line.asset))} time=${line.transition === 'fade' ? 500 : 0}]`)
        else if (line.action === 'bgm') out.push(line.asset ? `[playbgm storage=${quoted(tyranoAsset(line.asset))} loop=true]` : '[stopbgm]')
        else if (line.action === 'se') out.push(`[playse storage=${quoted(tyranoAsset(line.asset))}]`)
        else if (line.action === 'character') {
          const character = project.characters.find((item) => item.id === line.charId)
          const asset = character?.portraits.find((portrait) => portrait.id === line.portraitId)?.asset || character?.avatar || ''
          out.push(`[chara_show name=${quoted(line.charId)} storage=${quoted(tyranoAsset(asset))} pos=${line.position}]`)
        }
        else if (line.action === 'hide') out.push(`[chara_hide pos=${line.position}]`)
        else if (line.action === 'effect') out.push(line.screenEffect === 'shake' ? `[quake time=${line.duration} hmax=12 vmax=8]` : `; 画面効果 ${line.screenEffect} ${line.duration}ms`)
        else if (line.action === 'wait') out.push(`[wait time=${line.duration}]`)
      }
    }
    if (scene.ending) out.push('[s]')
    out.push('')
  }
  return out.join('\n')
}

export function portableScenario(project: Project) {
  return {
    format: 'scenario-editor-v5',
    title: project.title,
    start: project.startSceneId,
    variables: project.variables,
    characters: project.characters,
    scenes: project.scenes,
  }
}

export const generateGodotJSON = (project: Project) => JSON.stringify(portableScenario(project), null, 2)

export function generateUnityCSharp(project: Project): string {
  const className = `Scenario_${identifier(project.title)}`
  const json = JSON.stringify(portableScenario(project)).replaceAll('"', '""')
  return `// Generated by Scenario Editor\npublic static class ${className}\n{\n    public const string Json = @"${json}";\n}\n`
}

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

export function generateVoiceCSV(project: Project): string {
  const rows = [['voice_id', 'character', 'scene', 'text', 'file', 'status'].map(csv).join(',')]
  for (const scene of project.scenes) {
    for (const line of scene.lines) {
      if (line.kind !== 'say') continue
      const character = project.characters.find((item) => item.id === line.charId)?.name ?? ''
      rows.push([line.id, character, scene.title, line.text, line.voice, line.voice ? '設定済み' : '未収録'].map(csv).join(','))
    }
  }
  return `\uFEFF${rows.join('\r\n')}`
}
