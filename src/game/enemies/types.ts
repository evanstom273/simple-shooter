import type Phaser from 'phaser'
import type { Target } from '../targets.ts'

/** What enemies know about the player each frame. */
export interface PlayerInfo {
  x: number
  y: number
  vx: number
  vy: number
  /** Platform index the player is on, or will land on. */
  platform: number
  /** The camera's view of the world (the ranged enemy only fires when on screen). */
  view: Phaser.Geom.Rectangle
}

/** Taking turns (#49): one attacker at a time per turn group. */
export interface Turns {
  request(e: object): boolean
  release(e: object): void
  isOthers(e: object): boolean
}

/** Something that hurts the player that isn't an enemy's body: a shot, a shockwave. */
export interface Hazard {
  readonly x: number
  /** Stages of damage (#57). */
  readonly damage: number
  done: boolean
  update(dt: number): void
  /** Does it touch this rectangle (the player's body)? */
  hits(left: number, top: number, right: number, bottom: number): boolean
  destroy(): void
}

export interface Enemy extends Target {
  readonly dead: boolean
  /** Stages of damage when its body hits you mid-attack (#57, #58). */
  readonly damage: number
  /** Too heavy to knock back: your dash bounces off it (#58). */
  readonly heavy: boolean
  update(dt: number, player: PlayerInfo): void
}
