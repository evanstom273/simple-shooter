// Player state the React HUD shows (health), written by Phaser.
// Plain TS (no Phaser import) so React can use it without loading the game.

export interface HudWeapon {
  id: 'pistol' | 'automatic' | 'shotgun'
  ammo: number
  magazine: number
  /** 0…1 while reloading, else null. */
  reloading: number | null
}

interface HudState {
  weapons: HudWeapon[]
  currentWeapon: HudWeapon['id'] | null
  /** Health in stages (#48): pips × stagesPerPip. */
  health: number
  pips: number
  stagesPerPip: number
  /** Increments on every heal, so the UI can animate the pip. */
  healCount: number
  /** Index of the pip that just became full again (-1 = none). */
  healedPip: number
  /** Increments on every hit taken, so the UI can play a hurt pulse. */
  hurtCount: number
  /** Increments on every death (temporary refill until runs exist). */
  deathCount: number
}

let state: HudState = { weapons: [], currentWeapon: null, health: 20, pips: 5, stagesPerPip: 4, healCount: 0, healedPip: -1, hurtCount: 0, deathCount: 0 }
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
