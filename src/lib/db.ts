import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project } from '@/types'

/**
 * 永続化層。localStorage（5MB・単一プロジェクト）から IndexedDB へ移行し、
 * 複数プロジェクト・画像/音声アセット・自動バックアップを扱えるようにする。
 */

export interface ProjectMeta {
  id: string
  title: string
  updatedAt: number
}

export interface StoredAsset {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
  createdAt: number
  tags?: string[]
}

export interface Backup {
  key?: number
  projectId: string
  createdAt: number
  data: Project
}

interface Schema extends DBSchema {
  projects: { key: string; value: Project & { updatedAt: number } }
  assets: { key: string; value: StoredAsset }
  backups: { key: number; value: Backup; indexes: { byProject: string } }
  settings: { key: string; value: unknown }
}

const DB_NAME = 'scenario-editor'
const BACKUPS_PER_PROJECT = 15

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null

const db = () => {
  dbPromise ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore('projects', { keyPath: 'id' })
      database.createObjectStore('assets', { keyPath: 'id' })
      const backups = database.createObjectStore('backups', { keyPath: 'key', autoIncrement: true })
      backups.createIndex('byProject', 'projectId')
      database.createObjectStore('settings')
    },
  })
  return dbPromise
}

/* ---------------- projects ---------------- */

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await (await db()).getAll('projects')
  return all
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return (await db()).get('projects', id)
}

export async function saveProject(project: Project): Promise<void> {
  await (await db()).put('projects', { ...project, updatedAt: Date.now() })
}

export async function deleteProject(id: string): Promise<void> {
  const database = await db()
  await database.delete('projects', id)
  const keys = await database.getAllKeysFromIndex('backups', 'byProject', id)
  await Promise.all(keys.map((k) => database.delete('backups', k)))
}

/* ---------------- backups ---------------- */

export async function pushBackup(project: Project): Promise<void> {
  const database = await db()
  await database.add('backups', { projectId: project.id, createdAt: Date.now(), data: project })
  const keys = await database.getAllKeysFromIndex('backups', 'byProject', project.id)
  // 古いものから間引く
  await Promise.all(keys.slice(0, Math.max(0, keys.length - BACKUPS_PER_PROJECT)).map((k) => database.delete('backups', k)))
}

export async function listBackups(projectId: string): Promise<Backup[]> {
  const all = await (await db()).getAllFromIndex('backups', 'byProject', projectId)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

/* ---------------- assets ---------------- */

export const ASSET_PREFIX = 'asset:'
export const isAssetRef = (ref: string) => ref.startsWith(ASSET_PREFIX)
export const assetIdOf = (ref: string) => ref.slice(ASSET_PREFIX.length)

export async function putAsset(file: File): Promise<string> {
  const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  await (await db()).put('assets', {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    blob: file,
    createdAt: Date.now(),
    tags: [],
  })
  return ASSET_PREFIX + id
}

export async function putAssetBlob(id: string, name: string, type: string, blob: Blob, tags: string[] = []): Promise<void> {
  await (await db()).put('assets', { id, name, type, size: blob.size, blob, createdAt: Date.now(), tags })
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  return (await db()).get('assets', id)
}

export async function listAssets(): Promise<StoredAsset[]> {
  return (await (await db()).getAll('assets')).sort((a, b) => b.createdAt - a.createdAt)
}

export async function deleteAsset(id: string): Promise<void> {
  await (await db()).delete('assets', id)
}

export async function updateAssetTags(id: string, tags: string[]): Promise<void> {
  const database = await db()
  const asset = await database.get('assets', id)
  if (asset) await database.put('assets', { ...asset, tags })
}

/* ---------------- settings ---------------- */

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db()).get('settings', key) as Promise<T | undefined>
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', value, key)
}
