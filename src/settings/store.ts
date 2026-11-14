// Live settings shared by React (the settings panel) and Phaser (gameplay).
// Plain TS with no Phaser import, so the UI can use it without loading the game.

export type AimMode = 'manual' | 'autoAim' | 'fullAuto'

export const AIM_MODES: { id: AimMode; label: string; hint: string }[] = [
  { id: 'manual', label: 'Manual', hint: 'You aim and shoot.' },
  { id: 'autoAim', label: 'Auto aim', hint: 'Aims at the nearest enemy; you choose when to shoot.' },
  { id: 'fullAuto', label: 'Full auto', hint: 'Aims and shoots for you.' },
]

/** Defaults (#39): auto aim + manual shooting on touch screens, manual on desktop. */
export function defaultAimMode(): AimMode {
  const coarse = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)
  return coarse ? 'autoAim' : 'manual'
}

let aimMode: AimMode = defaultAimMode()
const listeners = new Set<() => void>()

export const settingsStore = {
  get aimMode() {
    return aimMode
  },
  setAimMode(m: AimMode) {
    aimMode = m
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
