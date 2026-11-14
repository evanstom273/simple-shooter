import { db } from './db.ts'

export interface Settings {
  muted: boolean
}

const DEFAULTS: Settings = { muted: false }
const ID = 'settings'

export async function loadSettings(): Promise<Settings> {
  try {
    const rec = await db.saves.get(ID)
    return { ...DEFAULTS, ...(rec?.data as Partial<Settings> | undefined) }
  } catch {
    return DEFAULTS
  }
}

export async function saveSettings(s: Settings) {
  try {
    await db.saves.put({ id: ID, data: s, updatedAt: Date.now() })
  } catch {
    // Private mode etc.: settings just won't persist.
  }
}
