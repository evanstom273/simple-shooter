// All numbers here are placeholders, to be tuned in play.

/** The arena: a fixed-size world, bigger than the screen; the camera follows the player around it. */
export const ARENA = { width: 2400, height: 1350 } as const

/**
 * Camera zoom. The baseline is the zoom at which a 1600×900 area would fill the
 * screen (the original arena); `zoom` scales that (0.8 = 20% further out).
 */
export const VIEW = { baseWidth: 1600, baseHeight: 900, zoom: 0.8 } as const

export const PLAYER = {
  size: 48,
  /** Top horizontal speed, px/s. */
  runSpeed: 460,
  /** How quickly horizontal speed reaches its target (higher = snappier). */
  responsiveness: 18,
  /** Upward speed on jump, px/s. Jump height ≈ jumpSpeed² / (2 × gravity). */
  jumpSpeed: 980,
  /** Jumps available in mid-air (1 = double jump). */
  airJumps: 1,
  /** Upward speed of an air jump, as a fraction of jumpSpeed. */
  airJumpScale: 0.9,
  /** Seconds after running off a ledge that a jump still counts as a ground jump. */
  coyoteTime: 0.1,
  /** Seconds a jump press is remembered before landing. */
  jumpBuffer: 0.12,
  /** Seconds that platforms ignore you after pressing down to drop through. */
  dropThrough: 0.22,
} as const

export const DASH = {
  /** Speed during the dash, px/s. Distance ≈ speed × duration. */
  speed: 1500,
  /** Seconds. You're invulnerable for the whole dash (#24). */
  duration: 0.15,
  /** Seconds from the start of one dash until the next is allowed. */
  cooldown: 0.8,
  /** Fraction of dash speed kept when it ends, so it doesn't stop dead. */
  carry: 0.35,
} as const

export const GRAVITY = 2400

/** Placeholder layout so there's something to jump on. Not a designed arena. */
// Four tiers ~180 px apart, each reachable with a single jump (~200 px).
export const PLATFORMS: ReadonlyArray<{ x: number; y: number; w: number; h: number; solid?: boolean }> = [
  { x: 0, y: 1310, w: 2400, h: 40, solid: true }, // floor: can't drop through it
  // tier 1
  { x: 200, y: 1130, w: 340, h: 24 },
  { x: 1030, y: 1130, w: 340, h: 24 },
  { x: 1860, y: 1130, w: 340, h: 24 },
  // tier 2
  { x: 560, y: 950, w: 320, h: 24 },
  { x: 1520, y: 950, w: 320, h: 24 },
  // tier 3
  { x: 140, y: 770, w: 300, h: 24 },
  { x: 1050, y: 770, w: 300, h: 24 },
  { x: 1960, y: 770, w: 300, h: 24 },
  // tier 4
  { x: 600, y: 590, w: 340, h: 24 },
  { x: 1460, y: 590, w: 340, h: 24 },
]

/** Screen feel. Shake intensity is a fraction of the screen size. */
export const SCREEN = {
  /** Camera follow smoothing per 60 Hz frame (1 = locked to the player). */
  followLerp: 0.2,
  /** How far the camera leads in the direction you're running, as a fraction of the visible width. */
  lookAhead: 0.15,
  /** How quickly the look-ahead eases in and out (per second). */
  lookAheadSpeed: 2.5,
  /** Drifting specks that catch the light. */
  motes: 100,
  /** Hard landing: shake scales with impact, nothing for small hops. */
  landShake: { duration: 110, intensity: 0.004 },
  /** Dashing into a wall, floor or ceiling. */
  dashImpactShake: { duration: 90, intensity: 0.005 },
  /**
   * Darkness around a pool of light that follows the player. Sits under the
   * player, effects (and later enemies and bullets), so only the arena darkens.
   * radius: fraction of the screen diagonal where it reaches full darkness.
   * clear: fraction of that radius that's fully lit. edge: darkness at the radius (0–1).
   */
  light: { radius: 0.62, clear: 0.22, edge: 0.92 },
}
