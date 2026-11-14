import Phaser from 'phaser'
import type { GameScene } from './GameScene.ts'
import { VIEW } from './tuning.ts'

// Screen-space arrows at the edge of the screen for every enemy you can't see
// (#44). Closer enemies get bigger, brighter arrows. The auto-aim target's
// arrow is yellow, larger and pulsing.

const TARGET_COLOUR = 0xfff2b0
const FAR = 1600

export class MarkersScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics
  private dpr = 1

  constructor() {
    super('markers')
  }

  create() {
    this.dpr = this.registry.get('dpr') ?? 1
    this.g = this.add.graphics()
  }

  update() {
    const game = this.scene.get('game') as GameScene
    const info = game.markerInfo
    const cam = game.cameras.main
    const g = this.g
    g.clear()
    const { width, height } = this.scale
    const inset = VIEW.markerInset * this.dpr
    const cx = width / 2
    const cy = height / 2
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 140)

    for (const t of info.targets) {
      if (!t.alive) continue
      // Screen position of the target.
      const sx = (t.x - cam.worldView.x) * cam.zoom
      const sy = (t.y - cam.worldView.y) * cam.zoom
      const r = t.radius * cam.zoom
      if (sx > -r && sx < width + r && sy > -r && sy < height + r) continue

      // Where the line from the screen centre to the target crosses the inset edge.
      const dx = sx - cx
      const dy = sy - cy
      const k = Math.min((cx - inset) / Math.abs(dx || 1e-6), (cy - inset) / Math.abs(dy || 1e-6))
      const ex = cx + dx * k
      const ey = cy + dy * k
      const angle = Math.atan2(dy, dx)

      const dist = Phaser.Math.Distance.Between(info.player.x, info.player.y, t.x, t.y)
      const near = 1 - Phaser.Math.Clamp(dist / FAR, 0, 1)
      const isTarget = t === info.target
      const size = (isTarget ? 16 + 3 * pulse : 9 + 6 * near) * this.dpr
      const colour = isTarget ? TARGET_COLOUR : t.colour
      const alpha = isTarget ? 0.95 : 0.35 + 0.55 * near

      // Arrowhead pointing at the enemy.
      const tip = { x: ex + Math.cos(angle) * size, y: ey + Math.sin(angle) * size }
      const back = angle + Math.PI
      const l = { x: ex + Math.cos(back + 0.6) * size * 0.8, y: ey + Math.sin(back + 0.6) * size * 0.8 }
      const rr = { x: ex + Math.cos(back - 0.6) * size * 0.8, y: ey + Math.sin(back - 0.6) * size * 0.8 }
      g.fillStyle(colour, alpha)
      g.fillTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y)
      if (isTarget) {
        g.lineStyle(2 * this.dpr, TARGET_COLOUR, 0.4 + 0.4 * pulse)
        g.strokeCircle(ex, ey, size * 1.25)
      }
    }
  }
}
