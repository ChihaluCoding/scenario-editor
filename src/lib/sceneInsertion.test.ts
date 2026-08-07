import { describe, expect, it } from 'vitest'
import type { Scene } from '@/types'
import { getSceneInsertionPlan } from './sceneInsertion'

const scene = (id: string, chapter: string) => ({ id, chapter }) as Scene

describe('getSceneInsertionPlan', () => {
  it('選択中または指定されたチャプターの末尾へ追加する', () => {
    const scenes = [scene('a', '共通'), scene('b', '個別'), scene('c', '共通')]
    expect(getSceneInsertionPlan(scenes, 'a')).toEqual({ chapter: '共通', index: 3 })
    expect(getSceneInsertionPlan(scenes, 'a', '個別')).toEqual({ chapter: '個別', index: 2 })
  })

  it('選択シーンや指定チャプターがない場合は未分類の末尾へ追加する', () => {
    const scenes = [scene('a', '未分類'), scene('b', '個別')]
    expect(getSceneInsertionPlan(scenes, 'missing')).toEqual({ chapter: '未分類', index: 1 })
    expect(getSceneInsertionPlan([], 'missing', '   ')).toEqual({ chapter: '未分類', index: 0 })
  })
})
