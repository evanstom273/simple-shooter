// The current run (#17, #18, #53), shared between Phaser (writes) and React (shows).
// Plain TS, no Phaser import.

export type Phase = 'fighting' | 'intermission' | 'over'

export interface RunState {
  wave: number
  phase: Phase
  /** Enemies still to defeat this wave (spawned or not). */
  left: number
  /** Gold in hand (spent in the shop, later). */
  gold: number
  /** Everything earned this run; spending never lowers it (#53). */
  score: number
  /** Gold earned during the wave just finished (for the count-up). */
  waveGold: number
  /** Seconds until the next wave, during the intermission. */
  countdown: number
  /** Increments each time a wave starts, so the UI can show a banner. */
  waveStarts: number
  /** Best score ever (from Dexie), and whether this run beat it. */
  best: number
  newBest: boolean
  kills: number
}

const initial = (best = 0): RunState => ({
  wave: 1,
  phase: 'intermission',
  left: 0,
  gold: 0,
  score: 0,
  waveGold: 0,
  countdown: 0,
  waveStarts: 0,
  best,
  newBest: false,
  kills: 0,
})

let state = initial()
const listeners = new Set<() => void>()

export const runStore = {
  get: () => state,
  set(patch: Partial<RunState>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
  },
  reset() {
    state = initial(state.best)
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

/** Asks the app to start a fresh run (remounts the game). */
const restartListeners = new Set<() => void>()
export const restartBus = {
  restart() {
    restartListeners.forEach((l) => l())
  },
  on(l: () => void) {
    restartListeners.add(l)
    return () => {
      restartListeners.delete(l)
    }
  },
}
