import Dexie, { type EntityTable } from 'dexie'

// IndexedDB via Dexie. One table for now; add tables/versions as the game needs them.
export interface SaveRecord {
  id: string
  data: unknown
  updatedAt: number
}

export const db = new Dexie('simple-shooter') as Dexie & {
  saves: EntityTable<SaveRecord, 'id'>
}

db.version(1).stores({
  saves: 'id, updatedAt',
})
