import { defaultAimMode, type AimMode } from '../settings/store.ts'
import { db } from './db.ts'

export interface Settings {
  muted: boolean
  aimMode: AimMode
}

const defaults = (): Settings => ({ muted: false, aimMode: defaultAimMode() })
const ID = 'settings'

export async function loadSettings(): Promise<Settings> {
  try {
    const rec = await db.saves.get(ID)
    return { ...defaults(), ...(rec?.data as Partial<Settings> | undefined) }
  } catch {
    return defaults()
  }
}

export async function saveSettings(s: Settings) {
  try {
    await db.saves.put({ id: ID, data: s, updatedAt: Date.now() })
  } catch {
    // Private mode etc.: settings just won't persist.
  }
}
