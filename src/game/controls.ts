// Input from every source (keyboard, mouse, touch) is merged into this each
// frame, so the gameplay code doesn't care where it came from.
export interface Controls {
  /** -1 (left) … 1 (right). */
  moveX: number
  /** True on the frame a jump was requested. */
  jump: boolean
  /** Holding down (drop through platforms). */
  down: boolean
  /** Set on the frame a dash was requested. A direction, or null to use the default (see GameScene). */
  dash: { x: number; y: number } | null
}

/** Touch input written by TouchControlsScene, read by GameScene. */
export const touchInput = {
  moveX: 0,
  /** Joystick direction including vertical, for aiming the dash. Zero when idle. */
  stickX: 0,
  stickY: 0,
  jumpQueued: false,
  dashQueued: false,
  /** 0 … 1, how far through the dash cooldown (1 = ready). Written by GameScene, drawn by the touch controls. */
  dashReady: 1,
  /** Whether the on-screen controls are showing (i.e. playing on touch). */
  controlsShown: false,
}
