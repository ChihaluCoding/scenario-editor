import { useMemo } from 'react'
import { AlertTriangle, CircleAlert, CheckCircle2 } from 'lucide-react'
import { useProject } from '@/store/project'
import { findIssues, projectStats } from '@/lib/analysis'
import { PanelHeading } from './ui'
import { ProductionInsights } from './production/ProductionInsights'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2">
      <div className="text-[10px] tracking-wide text-ink-400">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  )
}

export function Inspector({ onNavigate }: { onNavigate: (sceneId: string, lineId?: string) => void }) {
  const project = useProject((s) => s.project)
  const stats = useMemo(() => projectStats(project), [project])
  const issues = useMemo(() => findIssues(project), [project])
  const titleOf = (id: string) => project.scenes.find((s) => s.id === id)?.title ?? '?'

  return (
    <div className="flex flex-col gap-4">
      <section>
        <PanelHeading>統計</PanelHeading>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="シーン" value={stats.scenes} />
          <Stat label="行数" value={stats.lines} />
          <Stat label="文字数" value={stats.chars.toLocaleString()} />
          <Stat label="分岐" value={stats.branches} />
          <Stat label="変数" value={stats.variables} />
          <Stat label="読了目安" value={`${stats.minutes}分`} />
        </div>
      </section>

      <section>
        <PanelHeading>チェック ({issues.length})</PanelHeading>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-good/30 bg-good/10 px-2.5 py-2 text-xs text-good">
            <CheckCircle2 size={14} />
            問題は見つかりませんでした
          </p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {issues.map((issue, i) => (
              <li key={i}>
                <button
                  onClick={() => onNavigate(issue.sceneId)}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-ink-800"
                >
                  {issue.severity === 'error' ? (
                    <CircleAlert size={13} className="mt-0.5 shrink-0 text-bad" />
                  ) : (
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-warn" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-ink-300">{titleOf(issue.sceneId)}</span>
                    <span className="text-ink-100">{issue.message}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProductionInsights onNavigate={onNavigate} />
    </div>
  )
}
