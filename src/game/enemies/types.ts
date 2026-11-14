import type Phaser from 'phaser'
import type { HitSource, Target } from '../targets.ts'

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
  /** Alive and not flattened: can be hit, stomped or dashed. Flattened enemies can't be hit (#59). */
  readonly hittable: boolean
  /** Top of its body (for judging a stomp from above). */
  readonly top: number
  /** What last hit it: only dash and stomp kills heal you (#69). */
  readonly lastHitSource: HitSource
  /** Stomped from above (#59): knocked away (except the tank), flattened ~1 s. `damage` includes the dash/stomp upgrade (#69). */
  stomp(fromX: number, damage: number): void
  update(dt: number, player: PlayerInfo): void
  /** Shoved by the level (bounce pads, hazard knock), px/s (#81). */
  push?(vx: number, vy: number): void
  /** Fell into a pit (#81): dies at once. */
  fallOut?(): void
}
