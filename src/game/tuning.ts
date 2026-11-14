// All numbers here are placeholders, to be tuned in play.

/** The arena is a fixed-size world, scaled to fit whatever screen it's on. */
export const ARENA = { width: 1600, height: 900 } as const

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
export const PLATFORMS: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = [
  { x: 0, y: 860, w: 1600, h: 40 }, // floor
  { x: 180, y: 680, w: 320, h: 24 },
  { x: 1100, y: 680, w: 320, h: 24 },
  { x: 620, y: 520, w: 360, h: 24 },
  { x: 120, y: 380, w: 260, h: 24 },
  { x: 1220, y: 380, w: 260, h: 24 },
]
