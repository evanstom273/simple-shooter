// Input from every source (keyboard, touch) is merged into this each frame,
// so the gameplay code doesn't care where it came from.
export interface Controls {
  /** -1 (left) … 1 (right). */
  moveX: number
  /** True on the frame a jump was requested. */
  jump: boolean
}

/** Touch input written by TouchControlsScene, read by GameScene. */
export const touchInput = {
  moveX: 0,
  jumpQueued: false,
}
