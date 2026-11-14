import Phaser from 'phaser'

// Small one-shot effects built from plain shapes and tweens, to match the
// geometric look (#8). Each cleans itself up.

const rand = Phaser.Math.FloatBetween

/** Little squares that burst out from a point and fade. */
export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: {
    count: number
    colour: number
    /** Direction of travel in radians, and the spread either side of it. */
    angle: number
    spread: number
    speed: [number, number]
    size: [number, number]
    life?: number
    gravity?: number
    alpha?: number
  },
) {
  const life = opts.life ?? 320
  for (let i = 0; i < opts.count; i++) {
    const a = opts.angle + rand(-opts.spread, opts.spread)
    const sp = rand(opts.speed[0], opts.speed[1])
    const s = rand(opts.size[0], opts.size[1])
    const sq = scene.add.rectangle(x, y, s, s, opts.colour, opts.alpha ?? 0.8).setDepth(6).setAngle(rand(0, 90))
    const t = life / 1000
    const dx = Math.cos(a) * sp * t
    const dy = Math.sin(a) * sp * t + 0.5 * (opts.gravity ?? 0) * t * t
    scene.tweens.add({
      targets: sq,
      x: x + dx,
      y: y + dy,
      angle: sq.angle + rand(-120, 120),
      alpha: 0,
      scale: 0.3,
      duration: life * rand(0.7, 1),
      ease: 'Quad.easeOut',
      onComplete: () => sq.destroy(),
    })
  }
}

/** An expanding outline ring (ellipse) that fades. */
export function ring(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: number,
  opts: { grow?: number; life?: number; line?: number; alpha?: number } = {},
) {
  const r = scene.add
    .ellipse(x, y, w, h)
    .setStrokeStyle(opts.line ?? 3, colour, opts.alpha ?? 0.6)
    .setDepth(6)
  const g = opts.grow ?? 1.8
  scene.tweens.add({
    targets: r,
    alpha: 0,
    scaleX: g,
    scaleY: g,
    duration: opts.life ?? 260,
    ease: 'Quad.easeOut',
    onComplete: () => r.destroy(),
  })
}
