// Wave rules (pure functions, no Phaser): how big each wave is, what's in it,
// how many can be out at once, and what kills are worth. Endless (#18).
import { WAVES } from './tuning.ts'

export type EnemyKind = 'melee' | 'ranged' | 'tank'

/** Enemies in wave n (n from 1). */
export function waveSize(n: number) {
  return Math.min(WAVES.max, WAVES.first + (n - 1))
}

/** Max enemies in the arena at once in wave n. */
export function maxAlive(n: number) {
  return Math.min(WAVES.aliveMax, WAVES.aliveFirst + Math.floor((n - 1) / WAVES.aliveEvery))
}

/**
 * The mix for wave n (Lyra: wave 1 just melee; wave 2 mostly melee with some
 * shooters; builds gradually). Tanks join from wave 4, one more every 2 waves.
 */
export function waveMix(n: number) {
  const size = waveSize(n)
  const tank = n < 4 ? 0 : Math.min(4, 1 + Math.floor((n - 4) / 2))
  const rangedShare = n < 2 ? 0 : Math.min(0.4, 0.15 + (n - 2) * 0.05)
  const ranged = Math.round((size - tank) * rangedShare)
  const melee = size - tank - ranged
  return { melee, ranged, tank }
}

/** Spawn order for wave n: shuffled, but tanks never right at the start. */
export function waveOrder(n: number, rand: () => number = Math.random): EnemyKind[] {
  const { melee, ranged, tank } = waveMix(n)
  const list: EnemyKind[] = [...Array(melee).fill('melee'), ...Array(ranged).fill('ranged')]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  // Tanks spread through the back two-thirds of the wave.
  for (let t = 0; t < tank; t++) {
    const at = Math.floor(list.length / 3 + rand() * (list.length * 2 / 3))
    list.splice(at, 0, 'tank')
  }
  return list
}

/** Gold for killing `kind` in wave n: ×1 at wave 1, ×5 at wave 10 (Lyra: 50 → ~250), linear and endless. */
export function goldFor(kind: EnemyKind, n: number) {
  const scale = 1 + ((WAVES.goldAtWave10 - 1) * (n - 1)) / 9
  return Math.round((WAVES.gold[kind] * scale) / 5) * 5
}
