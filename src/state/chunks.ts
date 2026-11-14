// Chunks made in the chunk editor (#79), saved on this device. They join the
// generator's pool. To put one in the game for everyone, copy it from the
// editor and give it to Claude to add to gen/chunks.ts.
import { db } from '../persist/db.ts'
import type { Chunk } from '../game/gen/chunks.ts'

const ID = 'chunks'
let list: Chunk[] = []
const listeners = new Set<() => void>()

export function customChunks() {
  return list
}

export const chunkStore = {
  get: () => list,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  /** Add or replace (by id), and save. */
  put(c: Chunk) {
    const i = list.findIndex((x) => x.id === c.id)
    list = i >= 0 ? list.map((x, j) => (j === i ? c : x)) : [...list, c]
    changed()
  },
  remove(id: string) {
    list = list.filter((x) => x.id !== id)
    changed()
  },
}

function changed() {
  listeners.forEach((l) => l())
  void db.saves.put({ id: ID, data: list, updatedAt: Date.now() }).catch(() => {})
}

export async function loadChunks() {
  try {
    const rec = await db.saves.get(ID)
    if (Array.isArray(rec?.data)) list = rec.data as Chunk[]
  } catch {
    // Storage unavailable: no custom chunks.
  }
  listeners.forEach((l) => l())
}
