import { useDeferredValue, useMemo } from 'react'
import { Bookmark, CircleAlert, Flag, ListTodo, UserRound } from 'lucide-react'
import { useProject } from '@/store/project'
import { characterProductionStats } from '@/lib/productionAnalysis'
import { testRoutes } from '@/lib/routeTest'
import { ENDING_TYPE_LABEL, LINE_META } from '@/types'
import { PanelHeading } from '@/components/ui'

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`

export function ProductionInsights({ onNavigate }: { onNavigate: (sceneId: string, lineId?: string) => void }) {
  const project = useProject((state) => state.project)
  const deferredProject = useDeferredValue(project)
  const routes = useMemo(() => testRoutes(deferredProject), [deferredProject])
  const characters = useMemo(() => characterProductionStats(project), [project])
  const tasks = useMemo(() => project.scenes.flatMap((scene) =>
    scene.lines.flatMap((line, index) => line.todo || line.bookmarked ? [{
      sceneId: scene.id,
      lineId: line.id,
      sceneTitle: scene.title,
      lineLabel: `${index + 1}行目・${LINE_META[line.kind].label}`,
      todo: line.todo ?? '',
      bookmarked: Boolean(line.bookmarked),
    }] : []),
  ), [project])

  return (
    <>
      <section>
        <PanelHeading>ルートテスト</PanelHeading>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-2">
            <div className="text-[10px] text-ink-400">シーン到達率</div>
            <div className="font-semibold text-brand">{percent(routes.sceneCoverage)}</div>
          </div>
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-2">
            <div className="text-[10px] text-ink-400">行到達率</div>
            <div className="font-semibold text-brand">{percent(routes.lineCoverage)}</div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-ink-400">
          <span>{routes.processedStates}状態を検証</span>
          <span>{routes.endings.length}エンド到達</span>
        </div>
        {routes.issues.length > 0 && (
          <ul className="mt-1.5 flex max-h-36 flex-col gap-1 overflow-y-auto">
            {routes.issues.map((issue, index) => (
              <li key={`${issue.kind}-${issue.sceneId}-${issue.lineId}-${index}`}>
                <button onClick={() => onNavigate(issue.sceneId, issue.lineId)} className="flex w-full items-start gap-1.5 rounded-md bg-bad/7 px-2 py-1.5 text-left text-[11px] hover:bg-bad/12">
                  <CircleAlert size={12} className="mt-0.5 shrink-0 text-bad" />
                  <span>{issue.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <PanelHeading>TODO・ブックマーク ({tasks.length})</PanelHeading>
        {tasks.length === 0 ? (
          <p className="text-xs text-ink-400">台本行の右側から追加できます。</p>
        ) : (
          <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto">
            {tasks.map((task) => (
              <li key={task.lineId}>
                <button onClick={() => onNavigate(task.sceneId, task.lineId)} className="flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-ink-800">
                  {task.todo ? <ListTodo size={12} className="mt-0.5 shrink-0 text-warn" /> : <Bookmark size={12} className="mt-0.5 shrink-0 fill-warn text-warn" />}
                  <span className="min-w-0">
                    <span className="block truncate text-ink-300">{task.sceneTitle} / {task.lineLabel}</span>
                    <span className="block truncate">{task.todo || 'ブックマーク'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <PanelHeading>エンディング ({project.scenes.filter((scene) => scene.ending).length})</PanelHeading>
        <ul className="flex flex-col gap-1">
          {project.scenes.filter((scene) => scene.ending).map((scene) => {
            const route = routes.endings.find((item) => item.sceneId === scene.id)
            return (
              <li key={scene.id}>
                <button onClick={() => onNavigate(scene.id)} className="w-full rounded-md border border-ink-700 px-2 py-1.5 text-left hover:bg-ink-800">
                  <span className="flex items-center gap-1.5 text-xs font-medium"><Flag size={12} className="text-warn" />{ENDING_TYPE_LABEL[scene.ending!]} · {scene.title}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-ink-400">{route ? (route.choices.join(' → ') || '開始シーンから到達') : '未到達'}</span>
                </button>
              </li>
            )
          })}
          {!project.scenes.some((scene) => scene.ending) && <li className="text-xs text-ink-400">シーン設定から登録できます。</li>}
        </ul>
      </section>

      <section>
        <PanelHeading>キャラクター分析</PanelHeading>
        <ul className="flex flex-col gap-1">
          {characters.map((character) => (
            <li key={character.characterId} className="rounded-md border border-ink-700 px-2 py-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 text-xs font-medium"><UserRound size={12} className="text-brand" />{character.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-2 text-ink-400">
                <span>{character.lines}セリフ</span><span>{character.characters.toLocaleString()}字</span><span>{character.scenes}シーン</span>
              </div>
              {(character.longLines > 0 || character.repeatedEndings > 0) && (
                <div className="mt-1 text-warn">長文 {character.longLines}件 / 語尾の連続 {character.repeatedEndings}件</div>
              )}
            </li>
          ))}
          {characters.length === 0 && <li className="text-xs text-ink-400">キャラクターを追加すると集計されます。</li>}
        </ul>
      </section>
    </>
  )
}
