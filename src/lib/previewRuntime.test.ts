import { describe, expect, it } from 'vitest'
import { nanoid } from 'nanoid'
import { blankProject, newCharacter } from '@/lib/factory'
import { initialRuntime, runPreview } from '@/lib/previewRuntime'
import { initialVars } from '@/lib/vars'

describe('previewRuntime', () => {
  it('背景と立ち絵の演出を適用して次のセリフを返す', () => {
    const project = blankProject()
    const character = newCharacter('結衣', 0)
    character.portraits.push({ id: 'smile', name: '笑顔', asset: 'smile.png' })
    project.characters.push(character)
    project.scenes[0].lines = [
      { id: nanoid(), kind: 'stage', action: 'background', asset: 'roof.jpg', charId: '', portraitId: '', position: 'center', transition: 'cut', screenEffect: 'shake', duration: 500 },
      { id: nanoid(), kind: 'stage', action: 'character', asset: '', charId: character.id, portraitId: 'smile', position: 'right', transition: 'cut', screenEffect: 'shake', duration: 500 },
      { id: nanoid(), kind: 'say', charId: character.id, portraitId: 'smile', position: 'right', text: 'こんにちは', voice: '' },
    ]
    const runtime = initialRuntime(project)
    expect(runtime.frame.kind).toBe('say')
    expect(runtime.frame.stage.bg).toBe('roof.jpg')
    expect(runtime.frame.stage.characters.right?.portraitId).toBe('smile')
  })

  it('待機を独立したフレームとして返す', () => {
    const project = blankProject()
    project.scenes[0].lines = [{ id: nanoid(), kind: 'stage', action: 'wait', asset: '', charId: '', portraitId: '', position: 'center', transition: 'cut', screenEffect: 'shake', duration: 750 }]
    const runtime = runPreview(project, { sceneId: project.startSceneId, index: 0 }, initialVars(project.variables))
    expect(runtime.frame.kind).toBe('wait')
    expect(runtime.frame.duration).toBe(750)
  })
})
