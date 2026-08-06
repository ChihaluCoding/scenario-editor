import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge as RFEdge,
  type Node as RFNode,
  type NodeProps,
  type NodeChange,
} from '@xyflow/react'
import { clsx } from 'clsx'
import { Play } from 'lucide-react'
import { useProject } from '@/store/project'
import { buildEdges, reachableScenes, sceneCharCount } from '@/lib/analysis'
import { describeLine } from '@/lib/linePresentation'
import { ENDING_TYPE_LABEL, LINE_META, SCENE_STATUS_LABEL, type Project, type Scene } from '@/types'

type SceneNodeData = {
  scene: Scene
  project: Project
  isStart: boolean
  selected: boolean
  unreachable: boolean
  expanded: boolean
}

function SceneNode({ data }: NodeProps<RFNode<SceneNodeData>>) {
  const { scene, project, isStart, selected, unreachable, expanded } = data
  return (
    <div
      title={expanded ? 'ダブルクリックで詳細を閉じる' : 'ダブルクリックで詳細を開く'}
      data-flow-detail={expanded ? 'expanded' : 'compact'}
      className={clsx(
        'rounded-lg border-2 bg-ink-850 px-3 py-2 text-left shadow-lg transition-all duration-200',
        expanded ? 'w-[26rem]' : 'w-52',
        selected ? 'border-brand' : unreachable ? 'border-bad/50' : 'border-ink-600',
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5">
        {isStart && <Play size={10} className="shrink-0 fill-good text-good" />}
        <span className="truncate text-sm font-semibold text-ink-100">{scene.title || '(無題)'}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-ink-400">
        {scene.lines.length}行 · {sceneCharCount(scene)}字{unreachable && ' · 到達不可'}
      </div>
      {!expanded && scene.summary && <div className="mt-1 line-clamp-2 text-[11px] text-ink-300">{scene.summary}</div>}

      {expanded && (
        <div className="nodrag nopan mt-2.5 border-t border-ink-700 pt-2.5">
          <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
            <span className="rounded bg-ink-700 px-1.5 py-0.5">{SCENE_STATUS_LABEL[scene.status]}</span>
            <span className="rounded bg-ink-700 px-1.5 py-0.5">チャプター：{scene.chapter || '未分類'}</span>
            {scene.ending && <span className="rounded bg-warn/12 px-1.5 py-0.5 text-warn">{ENDING_TYPE_LABEL[scene.ending]} END</span>}
            {scene.bg && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-brand">背景あり</span>}
            {scene.bgm && <span className="rounded bg-brand/10 px-1.5 py-0.5 text-brand">BGMあり</span>}
          </div>

          <div className="mb-2 rounded-md bg-ink-900/55 px-2.5 py-2 text-[11px] leading-relaxed text-ink-300 whitespace-pre-wrap">
            {scene.summary || 'あらすじ・演出メモはありません'}
          </div>

          {scene.tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {scene.tags.map((tag) => <span key={tag} className="rounded-full border border-ink-700 px-1.5 py-0.5 text-[9px] text-ink-300">{tag}</span>)}
            </div>
          )}

          {scene.lines.length === 0 ? (
            <div className="rounded-md border border-dashed border-ink-700 py-4 text-center text-[11px] text-ink-400">台本行はありません</div>
          ) : (
            <ol className="nowheel flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
              {scene.lines.map((line, index) => (
                <li key={line.id} className="flex gap-2 rounded-md border border-ink-700/80 bg-ink-900/45 px-2 py-1.5">
                  <span className="w-4 shrink-0 text-right text-[9px] text-ink-400">{index + 1}</span>
                  <span className="mt-0.5 h-3.5 w-0.5 shrink-0 rounded-full" style={{ background: LINE_META[line.kind].accent }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[9px] text-ink-400">{LINE_META[line.kind].label}</div>
                    <p className="line-clamp-3 break-words text-[11px] leading-relaxed text-ink-100">{describeLine(line, project)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-2 text-right text-[9px] text-ink-400">ダブルクリックで閉じる</div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const nodeTypes = { scene: SceneNode }

const EDGE_STYLE = {
  choice: { stroke: 'var(--color-line-choice)' },
  jump: { stroke: 'var(--color-line-jump)' },
  fallthrough: { stroke: 'var(--color-flow-edge)', strokeDasharray: '5 4' },
} as const

function FlowInner() {
  const project = useProject((s) => s.project)
  const selectedSceneId = useProject((s) => s.selectedSceneId)
  const selectScene = useProject((s) => s.selectScene)
  const moveScene = useProject((s) => s.moveScene)
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null)

  const nodes = useMemo<RFNode<SceneNodeData>[]>(() => {
    const reachable = reachableScenes(project)
    return project.scenes.map((scene) => ({
      id: scene.id,
      type: 'scene',
      position: scene.pos,
      data: {
        scene,
        project,
        isStart: scene.id === project.startSceneId,
        selected: scene.id === selectedSceneId,
        unreachable: scene.id !== project.startSceneId && !reachable.has(scene.id),
        expanded: scene.id === expandedSceneId,
      },
    }))
  }, [project, selectedSceneId, expandedSceneId])

  const edges = useMemo<RFEdge[]>(
    () =>
      buildEdges(project).map((e, i) => ({
        id: `${e.from}-${e.to}-${i}`,
        source: e.from,
        target: e.to,
        label: e.label || undefined,
        type: 'smoothstep',
        animated: e.kind === 'choice',
        style: e.conditional
          ? { ...EDGE_STYLE[e.kind], strokeDasharray: '4 4', opacity: 0.85 }
          : EDGE_STYLE[e.kind],
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_STYLE[e.kind].stroke },
        labelStyle: { fill: 'var(--color-ink-100)', fontSize: 11 },
        labelBgStyle: { fill: 'var(--color-ink-800)' },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      })),
    [project],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<RFNode<SceneNodeData>>[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) moveScene(c.id, c.position)
      }
    },
    [moveScene],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeClick={(_, node) => selectScene(node.id)}
      onNodeDoubleClick={(_, node) => setExpandedSceneId((current) => current === node.id ? null : node.id)}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      className="bg-ink-950"
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--color-flow-grid)" />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

export function FlowView() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  )
}
