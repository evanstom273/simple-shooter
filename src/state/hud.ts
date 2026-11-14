// Player state the React HUD shows (health), written by Phaser.
// Plain TS (no Phaser import) so React can use it without loading the game.

interface HudState {
  health: number
  maxHealth: number
  /** Increments on every hit taken, so the UI can play a hurt pulse. */
  hurtCount: number
  /** Increments on every death (temporary refill until runs exist). */
  deathCount: number
}

let state: HudState = { health: 5, maxHealth: 5, hurtCount: 0, deathCount: 0 }
const listeners = new Set<() => void>()

export const hudStore = {
  get: () => state,
  set(patch: Partial<HudState>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
