// Bosses (#107–#116): what a boss needs from the game scene, and what the scene
// needs from a boss. Each boss is its own class; the scene only talks to it
// through these two interfaces.
import type Phaser from 'phaser'
import type { Enemy, Hazard } from '../enemies/types.ts'
import type { Environment } from '../Environment.ts'
import type { Level } from '../levels.ts'

export type BossId = 'rose' | 'ossuary' | 'gale' | 'firmament'

/** The player, as bosses see it each frame. */
export interface BossPlayer {
  x: number
  y: number
  vx: number
  vy: number
  left: number
  right: number
  top: number
  bottom: number
  grounded: boolean
}

export interface Candle {
  x: number
  y: number
  lit: boolean
}

/** What the scene gives a boss. */
export interface BossCtx {
  scene: Phaser.Scene
  level: Level
  env: Environment
  player: BossPlayer
  /** Shots, shockwaves, beams: hurt the player on touch. */
  addHazard(h: Hazard): void
  /** Call in a Mote (#107): every mini boss's own enemy. */
  spawnMote(x: number, y: number, vx?: number, vy?: number): void
  motesAlive(): number
  shake(ms: number, intensity: number): void
  /** Add to the player's velocity (the Ossuary's pull). */
  nudgePlayer(vx: number, vy: number): void
  /** Swallowed (#115): the player vanishes into (x, y) until released. Never a kill. */
  swallowPlayer(x: number, y: number): void
  /** Spit the player back out with this velocity, down to nearly dead. */
  releasePlayer(vx: number, vy: number): void
  /** The room's candles (#93), which bosses snuff and eat. */
  candles: Candle[]
  setCandle(i: number, lit: boolean): void
  /** 0 = normal light, 1 = the light swallowed (#113). */
  setDark(k: number): void
  /** The Firmament's window breaking (#113): pull the camera back, take control away for `seconds`. */
  pullBack(seconds: number): void
}

/** What a boss gives the scene. */
export interface Boss {
  readonly name: string
  /** Everything that can be shot, dashed or stomped right now. */
  readonly parts: Enemy[]
  /** Health bars (the Firmament has two, #111) and the fraction left of the current one. */
  readonly bars: number
  readonly bar: number
  readonly hp: number
  readonly dead: boolean
  /** Where the gold falls when it dies. */
  readonly x: number
  readonly y: number
  update(dt: number): void
  destroy(): void
}

export const BOSS_NAMES: Record<BossId, string> = {
  rose: 'The Rose',
  ossuary: 'The Ossuary',
  gale: 'The Gale',
  firmament: 'The Firmament',
}

/** Gold for beating each (placeholder, Claude). */
export const BOSS_GOLD: Record<BossId, number> = { rose: 600, ossuary: 800, gale: 800, firmament: 2000 }
