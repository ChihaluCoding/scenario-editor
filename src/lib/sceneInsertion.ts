import type { Scene } from '@/types'

const DEFAULT_CHAPTER = '未分類'

/** 新規シーンの所属チャプターと、そのチャプター末尾の挿入位置を決める。 */
export function getSceneInsertionPlan(
  scenes: Scene[],
  selectedSceneId: string,
  requestedChapter?: string,
): { chapter: string; index: number } {
  const selected = scenes.find((scene) => scene.id === selectedSceneId)
  const chapter = requestedChapter?.trim() || selected?.chapter?.trim() || DEFAULT_CHAPTER
  let lastChapterIndex = -1
  for (let index = 0; index < scenes.length; index += 1) {
    if ((scenes[index].chapter || DEFAULT_CHAPTER) === chapter) lastChapterIndex = index
  }
  return {
    chapter,
    index: lastChapterIndex >= 0 ? lastChapterIndex + 1 : scenes.length,
  }
}
