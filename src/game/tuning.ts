// All numbers here are placeholders, to be tuned in play.

/** The arena: a fixed-size world, bigger than the screen; the camera follows the player around it. */
export const ARENA = { width: 2400, height: 1350 } as const

/**
 * Camera zoom. The baseline is the zoom at which a 1600×900 area would fill the
 * screen (the original arena); `zoom` scales that (0.8 = 20% further out).
 */
export const VIEW = {
  baseWidth: 1600,
  baseHeight: 900,
  zoom: 0.8,
  /** When the auto-aim target is off screen, zoom out up to this fraction to bring it in (#44). */
  targetZoomOut: 0.15,
  /** Easing speeds (per second): out quickly, back in slowly. */
  zoomOutSpeed: 3,
  zoomInSpeed: 1.2,
  /** Off-screen markers: inset from the screen edge, in CSS px. */
  markerInset: 26,
} as const

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
  /** Health (#57): pips × stages per pip. 5 × 4 = 20. */
  pips: 5,
  stagesPerPip: 4,
  /** Seconds of invulnerability after a hit (#27). */
  hurtInvulnerability: 1,
  /** Knockback when hit: sideways away from the source, and up, px/s. */
  hurtKnockback: { x: 520, y: 480 },
  /** Freeze-frames, seconds: on taking a hit, and on landing a dash hit. */
  hurtHitStop: 0.08,
  dashHitStop: 0.05,
} as const

export const DASH = {
  /** Speed during the dash, px/s. Distance ≈ speed × duration. */
  speed: 1500,
  /** Seconds. You're invulnerable for the whole dash (#24). */
  duration: 0.15,
  /** Seconds from the start of one dash until the next is allowed. */
  cooldown: 1.6,
  /** Fraction of dash speed kept when it ends, so it doesn't stop dead. */
  carry: 0.35,
  /** Seconds of invulnerability after a dash ends, so ending inside an enemy doesn't hurt. */
  grace: 0.12,
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

/** Weapons. Only the pistol exists so far (a temporary starting weapon until upgrades exist). */
export const WEAPONS = {
  pistol: {
    /** Shots per second while the trigger is held. */
    fireRate: 4,
    bulletSpeed: 1900,
    damage: 1,
    /** Push back on the player per shot, px/s. */
    recoil: 60,
  },
} as const

export const AIM = {
  /** Auto-aim range in world px (#38). Placeholder. */
  range: 700,
  /** Only switch to a new target if it's this much closer than the current one (stops the bracket flickering). */
  switchMargin: 0.15,
} as const


/** Melee enemy (#40). All placeholders, to tune in play. */
export const MELEE = {
  colour: 0xff8a2a,
  hotColour: 0xfff0d8,
  /** Radius: diameter ≈ 1.1× the player's square (#50). */
  radius: 26,
  health: 3,
  /** Quick little hops. */
  hopSpeedX: 240,
  hopSpeedY: 380,
  hopPause: 0.06,
  /** Starts a lunge when this close (px). */
  attackRange: 300,
  /** Seconds of wind-up (glow + whine). */
  windup: 0.5,
  rollSpeed: 880,
  /** A roll ends after this many wall bounces or this many seconds. */
  rollBounces: 2,
  rollTime: 1.6,
  /** Leap: seconds in the air to reach where you were. */
  leapTime: 0.55,
  dizzy: 1.0,
  /** Seconds after dizziness before it can lunge again. */
  attackCooldown: 0.8,
  /** Knockback when hit, px/s. */
  knockback: 520,
  /** Temporary spawner (until waves): keep this many in the arena. */
  keepAlive: 2,
  respawnDelay: 2,
  /** Stages of damage when a lunge hits you (#57). */
  damage: 2,
  /** Taking turns (#49): enemies without the attack turn keep about this far away. */
  waitDistance: 400,
  /** Seconds between one enemy's turn ending and the next one's starting. */
  turnGap: 0.5,
  spawnWarning: 1,
} as const

/** Ranged enemy (#56). All placeholders, to tune in play. */
export const RANGED = {
  colour: 0x5ee36a,
  hotColour: 0xeaffd8,
  /** Circumradius of the triangle: smaller than the player. */
  radius: 18,
  health: 1,
  /** Preferred position: this far from you, this far above. */
  preferredDistance: 520,
  preferredHeight: 220,
  hoverSpeed: 240,
  /** Gets this close and it darts away. */
  dartTrigger: 260,
  dartSpeed: 1100,
  dartTime: 0.22,
  dartCooldown: 1,
  /** Will only start a shot from within this range, and only when on screen. */
  fireRange: 950,
  /** Charge (aim line tracks your predicted path), then lock (line freezes), then fire. */
  charge: 0.9,
  lock: 0.35,
  shotSpeed: 1150,
  /** Seconds between shots. */
  reload: 2.2,
  /** Stages per hit (#56). */
  damage: 2,
} as const

/** Tank enemy (#58). All placeholders, to tune in play. */
export const TANK = {
  colour: 0xe0453a,
  hotColour: 0xfff0e0,
  /** 2× the player: body width/height. */
  size: 96,
  health: 8,
  walkSpeed: 95,
  /** Starts a slam when within this range. */
  slamRange: 520,
  windup: 1.0,
  /** Seconds in the air from leap to slam. */
  leapTime: 0.7,
  /** Long recovery after a slam: the punish window. */
  recovery: 2.0,
  /** Seconds after recovering before it can slam again. */
  slamCooldown: 1.5,
  shockwaveSpeed: 700,
  shockwaveHeight: 46,
  /** Stages per hit, slam or shockwave (#58). */
  damage: 4,
  /** Your dash bounces off it at this speed (px/s). */
  dashBounce: 520,
} as const

/**
 * Temporary spawner until waves exist: how many of each to keep in the arena.
 * All 0 while testing: spawn by hand with the on-screen buttons or E / R / T.
 */
export const SPAWNER = { melee: 0, ranged: 0, tank: 0 } as const
