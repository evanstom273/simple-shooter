// Anything that can be shot or auto-aimed at. Practice dummies now; enemies later.
export interface Target {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly alive: boolean
  /** Colour for its off-screen marker (matches the enemy). */
  readonly colour: number
  hit(damage: number, dir: { x: number; y: number }): void
}
