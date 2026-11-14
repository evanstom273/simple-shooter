// Anything that can be shot or auto-aimed at.
/** 'hazard': spikes, saws, jets, pits (#81): no heal, like shots. */
export type HitSource = 'dash' | 'stomp' | 'shot' | 'hazard'
export interface Target {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly alive: boolean
  /** True while it's actively attacking (a lunge): only then does touching it hurt (#52). */
  readonly attacking: boolean
  /** Colour for its off-screen marker (matches the enemy). */
  readonly colour: number
  /** `source`: dashes and stomps can interrupt an enemy's attack; shots only damage it (#68). */
  hit(damage: number, dir: { x: number; y: number }, source?: HitSource): void
}
