import { create } from 'zustand'
import { produce } from 'immer'
import { nanoid } from 'nanoid'
import {
  projectSchema,
  type Character,
  type Line,
  type LineKind,
  type Project,
  type Scene,
  type SceneTemplate,
  type VarType,
  type Variable,
} from '@/types'
import { blankProject, newCharacter, newLine, newScene, newVariable } from '@/lib/factory'
import * as db from '@/lib/db'
import { cloneTemplateLines } from '@/lib/templates'

const HISTORY_LIMIT = 100
/** 連続入力を1つの Undo にまとめる猶予（ms） */
const COALESCE_MS = 700
const AUTOSAVE_MS = 600
/** この間隔でスナップショットを退避する */
const BACKUP_INTERVAL_MS = 3 * 60 * 1000

type Recipe = (draft: Project) => void

interface EditOptions {
  /** 同じキーの編集が短時間に続く場合、履歴を1件にまとめる（テキスト入力向け） */
  coalesce?: string
}

interface ProjectStore {
  project: Project
  selectedSceneId: string
  past: Project[]
  future: Project[]
  projects: db.ProjectMeta[]
  hydrated: boolean
  saving: boolean

  init: () => Promise<void>
  refreshProjects: () => Promise<void>
  switchProject: (id: string) => Promise<void>
  createProject: (title?: string) => Promise<void>
  duplicateProject: () => Promise<void>
  deleteProject: (id: string) => Promise<void>
  importProject: (p: Project) => Promise<void>
  restoreBackup: (data: Project) => void

  edit: (recipe: Recipe, opts?: EditOptions) => void
  undo: () => void
  redo: () => void

  selectScene: (id: string) => void
  addScene: () => void
  removeScene: (id: string) => void
  duplicateScene: (id: string) => void
  setStartScene: (id: string) => void
  moveScene: (id: string, pos: { x: number; y: number }) => void
  updateScene: (id: string, patch: Partial<Scene>) => void

  addCharacter: (name: string) => void
  updateCharacter: (id: string, patch: Partial<Character>) => void
  removeCharacter: (id: string) => void

  addVariable: (name: string, type: VarType) => void
  updateVariable: (id: string, patch: Partial<Variable>) => void
  removeVariable: (id: string) => void

  addLine: (sceneId: string, kind: LineKind, atIndex?: number) => void
  updateLine: (sceneId: string, lineId: string, patch: Partial<Line>) => void
  removeLine: (sceneId: string, lineId: string) => void
  reorderLines: (sceneId: string, from: number, to: number) => void

  addTemplate: (sceneId: string, name: string) => void
  removeTemplate: (id: string) => void
  applyTemplate: (sceneId: string, templateId: string) => void
}

let lastCoalesce: { key: string; at: number } | null = null

/** 存在しない ID を指す参照を掃除する（シーン削除・変数削除の後始末） */
function prune(draft: Project) {
  const sceneIds = new Set(draft.scenes.map((s) => s.id))
  const varIds = new Set(draft.variables.map((v) => v.id))
  const cleanCond = (holder: { cond?: { items: { varId: string }[] } }) => {
    if (!holder.cond) return
    holder.cond.items = holder.cond.items.filter((c) => varIds.has(c.varId))
    if (holder.cond.items.length === 0) delete holder.cond
  }

  const cleanLines = (lines: Line[]) => {
    for (const line of lines) {
      cleanCond(line)
      if (line.kind === 'jump' && line.next && !sceneIds.has(line.next)) line.next = ''
      if (line.kind === 'set') line.effects = line.effects.filter((e) => varIds.has(e.varId))
      if (line.kind === 'choice') {
        for (const opt of line.options) {
          cleanCond(opt)
          opt.effects = opt.effects.filter((e) => varIds.has(e.varId))
          if (opt.next && !sceneIds.has(opt.next)) opt.next = ''
        }
      }
    }
  }
  for (const scene of draft.scenes) cleanLines(scene.lines)
  for (const template of draft.templates) cleanLines(template.lines)
  if (!sceneIds.has(draft.startSceneId)) draft.startSceneId = draft.scenes[0].id
}

/* ---------------- 自動保存 ---------------- */

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastBackupAt = 0

function scheduleSave(project: Project, set: (partial: Partial<ProjectStore>) => void) {
  if (saveTimer) clearTimeout(saveTimer)
  set({ saving: true })
  saveTimer = setTimeout(async () => {
    await db.saveProject(project)
    if (Date.now() - lastBackupAt > BACKUP_INTERVAL_MS) {
      lastBackupAt = Date.now()
      await db.pushBackup(project)
    }
    set({ saving: false })
    void useProject.getState().refreshProjects()
  }, AUTOSAVE_MS)
}

export const useProject = create<ProjectStore>()((set, get) => {
  const commit = (next: Project, extra?: Partial<ProjectStore>) => {
    set({ project: next, ...extra })
    scheduleSave(next, set)
  }

  const edit: ProjectStore['edit'] = (recipe, opts) => {
    const { project, past } = get()
    const next = produce(project, (draft) => {
      recipe(draft)
      prune(draft)
    })
    if (next === project) return

    const now = Date.now()
    const merge =
      !!opts?.coalesce &&
      lastCoalesce?.key === opts.coalesce &&
      now - lastCoalesce.at < COALESCE_MS &&
      past.length > 0
    lastCoalesce = opts?.coalesce ? { key: opts.coalesce, at: now } : null

    commit(next, {
      past: merge ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
    })
  }

  const selectValid = (p: Project, preferred: string) =>
    p.scenes.some((s) => s.id === preferred) ? preferred : p.scenes[0].id

  /** 別プロジェクトを開く（履歴はリセット） */
  const open = (p: Project) => {
    lastCoalesce = null
    lastBackupAt = 0
    set({ project: p, selectedSceneId: p.startSceneId, past: [], future: [] })
  }

  return {
    project: blankProject(),
    selectedSceneId: '',
    past: [],
    future: [],
    projects: [],
    hydrated: false,
    saving: false,

    /* ---------------- 起動処理 ---------------- */

    init: async () => {
      const metas = await db.listProjects()
      const lastId = await db.getSetting<string>('lastProjectId')
      const target = metas.find((m) => m.id === lastId) ?? metas[0]

      if (target) {
        const loaded = await db.loadProject(target.id)
        const parsed = projectSchema.safeParse(loaded)
        if (parsed.success) {
          open(parsed.data)
          set({ projects: metas, hydrated: true })
          return
        }
      }

      // 旧バージョン（localStorage）からの引き継ぎ
      const legacy = migrateFromLocalStorage()
      const project = legacy ?? get().project
      await db.saveProject(project)
      await db.setSetting('lastProjectId', project.id)
      open(project)
      set({ projects: await db.listProjects(), hydrated: true })
    },

    refreshProjects: async () => set({ projects: await db.listProjects() }),

    switchProject: async (id) => {
      if (id === get().project.id) return
      if (saveTimer) {
        clearTimeout(saveTimer)
        await db.saveProject(get().project)
      }
      const loaded = await db.loadProject(id)
      const parsed = projectSchema.safeParse(loaded)
      if (!parsed.success) return
      open(parsed.data)
      await db.setSetting('lastProjectId', id)
      set({ saving: false, projects: await db.listProjects() })
    },

    createProject: async (title) => {
      const p = blankProject(title)
      await db.saveProject(p)
      await db.setSetting('lastProjectId', p.id)
      open(p)
      set({ projects: await db.listProjects() })
    },

    duplicateProject: async () => {
      const src = get().project
      const copy: Project = { ...structuredClone(src), id: `p_${nanoid(10)}`, title: `${src.title} のコピー` }
      await db.saveProject(copy)
      await db.setSetting('lastProjectId', copy.id)
      open(copy)
      set({ projects: await db.listProjects() })
    },

    deleteProject: async (id) => {
      await db.deleteProject(id)
      const metas = await db.listProjects()
      set({ projects: metas })
      if (id !== get().project.id) return
      if (metas[0]) await get().switchProject(metas[0].id)
      else await get().createProject()
    },

    importProject: async (p) => {
      // ID 衝突を避けるため、既存プロジェクトと重なる場合は振り直す
      const exists = get().projects.some((m) => m.id === p.id)
      const project = exists ? { ...p, id: `p_${nanoid(10)}` } : p
      await db.saveProject(project)
      await db.setSetting('lastProjectId', project.id)
      open(project)
      set({ projects: await db.listProjects() })
    },

    restoreBackup: (data) => {
      const { project, past } = get()
      commit({ ...data, id: project.id }, { past: [...past, project].slice(-HISTORY_LIMIT), future: [] })
    },

    /* ---------------- 編集 ---------------- */

    edit,

    undo: () => {
      const { past, project, future, selectedSceneId } = get()
      const prev = past.at(-1)
      if (!prev) return
      lastCoalesce = null
      commit(prev, {
        past: past.slice(0, -1),
        future: [project, ...future].slice(0, HISTORY_LIMIT),
        selectedSceneId: selectValid(prev, selectedSceneId),
      })
    },

    redo: () => {
      const { past, project, future, selectedSceneId } = get()
      const next = future[0]
      if (!next) return
      lastCoalesce = null
      commit(next, {
        past: [...past, project].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        selectedSceneId: selectValid(next, selectedSceneId),
      })
    },

    selectScene: (id) => set({ selectedSceneId: id }),

    addScene: () => {
      const last = get().project.scenes.at(-1)
      const scene = newScene(`シーン ${get().project.scenes.length + 1}`, {
        x: (last?.pos.x ?? 0) + 40,
        y: (last?.pos.y ?? 0) + 200,
      })
      edit((d) => {
        d.scenes.push(scene)
      })
      set({ selectedSceneId: scene.id })
    },

    removeScene: (id) => {
      if (get().project.scenes.length <= 1) return
      const idx = get().project.scenes.findIndex((s) => s.id === id)
      edit((d) => {
        d.scenes = d.scenes.filter((s) => s.id !== id)
      })
      const scenes = get().project.scenes
      set({ selectedSceneId: (scenes[idx] ?? scenes.at(-1)!).id })
    },

    duplicateScene: (id) => {
      const src = get().project.scenes.find((s) => s.id === id)
      if (!src) return
      const copy: Scene = {
        ...structuredClone(src),
        id: nanoid(8),
        title: `${src.title} のコピー`,
        pos: { x: src.pos.x + 260, y: src.pos.y + 40 },
      }
      copy.lines = copy.lines.map((l) =>
        l.kind === 'choice'
          ? { ...l, id: nanoid(8), options: l.options.map((o) => ({ ...o, id: nanoid(6) })) }
          : { ...l, id: nanoid(8) },
      )
      edit((d) => {
        d.scenes.splice(d.scenes.findIndex((s) => s.id === id) + 1, 0, copy)
      })
      set({ selectedSceneId: copy.id })
    },

    setStartScene: (id) => edit((d) => void (d.startSceneId = id)),

    moveScene: (id, pos) =>
      edit(
        (d) => {
          const s = d.scenes.find((x) => x.id === id)
          if (s) s.pos = pos
        },
        { coalesce: `move:${id}` },
      ),

    updateScene: (id, patch) =>
      edit(
        (d) => {
          const scene = d.scenes.find((item) => item.id === id)
          if (scene) Object.assign(scene, patch)
        },
        { coalesce: `scene:${id}:${Object.keys(patch).join()}` },
      ),

    addCharacter: (name) =>
      edit((d) => {
        d.characters.push(newCharacter(name, d.characters.length))
      }),

    updateCharacter: (id, patch) =>
      edit(
        (d) => {
          const c = d.characters.find((x) => x.id === id)
          if (c) Object.assign(c, patch)
        },
        { coalesce: `char:${id}:${Object.keys(patch).join()}` },
      ),

    removeCharacter: (id) =>
      edit((d) => {
        d.characters = d.characters.filter((c) => c.id !== id)
        const collections = [...d.scenes.map((scene) => scene.lines), ...d.templates.map((template) => template.lines)]
        for (const lines of collections) {
          for (const line of lines) {
            if ((line.kind === 'say' || line.kind === 'stage') && line.charId === id) line.charId = ''
          }
        }
      }),

    addVariable: (name, type) =>
      edit((d) => {
        d.variables.push(newVariable(name, type))
      }),

    updateVariable: (id, patch) =>
      edit(
        (d) => {
          const v = d.variables.find((x) => x.id === id)
          if (v) Object.assign(v, patch)
        },
        { coalesce: `var:${id}:${Object.keys(patch).join()}` },
      ),

    removeVariable: (id) =>
      edit((d) => {
        d.variables = d.variables.filter((v) => v.id !== id)
      }),

    addLine: (sceneId, kind, atIndex) =>
      edit((d) => {
        const s = d.scenes.find((x) => x.id === sceneId)
        if (!s) return
        const line = newLine(kind)
        if (atIndex == null) s.lines.push(line)
        else s.lines.splice(atIndex, 0, line)
      }),

    updateLine: (sceneId, lineId, patch) =>
      edit(
        (d) => {
          const s = d.scenes.find((x) => x.id === sceneId)
          const l = s?.lines.find((x) => x.id === lineId)
          if (l) Object.assign(l, patch)
        },
        { coalesce: `line:${lineId}:${Object.keys(patch).join()}` },
      ),

    removeLine: (sceneId, lineId) =>
      edit((d) => {
        const s = d.scenes.find((x) => x.id === sceneId)
        if (s) s.lines = s.lines.filter((l) => l.id !== lineId)
      }),

    reorderLines: (sceneId, from, to) =>
      edit((d) => {
        const s = d.scenes.find((x) => x.id === sceneId)
        if (!s) return
        const [moved] = s.lines.splice(from, 1)
        s.lines.splice(to, 0, moved)
      }),

    addTemplate: (sceneId, name) =>
      edit((d) => {
        const scene = d.scenes.find((item) => item.id === sceneId)
        if (!scene || !name.trim()) return
        const template: SceneTemplate = {
          id: nanoid(8),
          name: name.trim(),
          lines: structuredClone(scene.lines),
        }
        d.templates.push(template)
      }),

    removeTemplate: (id) =>
      edit((d) => {
        d.templates = d.templates.filter((template) => template.id !== id)
      }),

    applyTemplate: (sceneId, templateId) => {
      const template = get().project.templates.find((item) => item.id === templateId)
      if (!template) return
      const lines = cloneTemplateLines(template.lines)
      edit((d) => {
        const scene = d.scenes.find((item) => item.id === sceneId)
        if (scene) scene.lines.push(...lines)
      })
    },
  }
})

/** v2（localStorage 保存）のデータがあれば引き継ぐ */
function migrateFromLocalStorage(): Project | null {
  try {
    const raw = localStorage.getItem('scenario-editor:v2')
    if (!raw) return null
    const saved = JSON.parse(raw)?.state?.project
    const parsed = projectSchema.safeParse(saved)
    if (!parsed.success) return null
    localStorage.removeItem('scenario-editor:v2')
    return parsed.data
  } catch {
    return null
  }
}

/* ---- セレクタ ---- */
export const useSelectedScene = () =>
  useProject((s) => s.project.scenes.find((x) => x.id === s.selectedSceneId) ?? s.project.scenes[0])
