// Where the game is (#62, #70): the hub, a world's section, or endless mode.
// Going somewhere remounts the game so every system starts fresh.
import type { Level } from '../game/levels.ts'

export type Destination =
  | { mode: 'hub' }
  | { mode: 'section'; world: 1 | 2 | 3 | 4; section: number }
  | { mode: 'endless' }
  /** Testing (#82, #79): a given level, no waves; spawn enemies from the Testing panel. */
  | { mode: 'sandbox'; level: Level; title: string; back?: 'hub' | 'editor'; chunkId?: string }
  /** The chunk editor (#79), full screen, no game running. */
  | { mode: 'editor'; chunkId?: string }

let dest: Destination = { mode: 'hub' }
const listeners = new Set<() => void>()

export const navStore = {
  get: () => dest,
  go(d: Destination) {
    dest = d
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
