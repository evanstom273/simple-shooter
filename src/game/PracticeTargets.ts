import Phaser from 'phaser'
import { sfx } from '../audio/sfx.ts'
import { burst, ring } from './fx.ts'
import type { Target } from './targets.ts'
import { DUMMY } from './tuning.ts'

// Temporary: plain grey circles to shoot at while there are no enemies.
// They don't move or fight back. Removed when the melee enemy goes in.

const GREY = 0x8a8a9c

class Dummy implements Target {
  readonly radius = DUMMY.radius
  alive = true
  private hp: number = DUMMY.health
  private o: Phaser.GameObjects.Arc
  private scene: Phaser.Scene
  readonly x: number
  readonly y: number

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene
    this.x = x
    this.y = y
    this.o = scene.add.circle(x, y, this.radius, GREY).setStrokeStyle(3, 0xc8c8d8, 0.8).setDepth(7)
  }

  hit(damage: number, dir: { x: number; y: number }) {
    if (!this.alive) return
    this.hp -= damage
    const o = this.o
    // Flash, squash and nudge back along the shot.
    o.setFillStyle(0xffffff)
    this.scene.time.delayedCall(60, () => o.active && o.setFillStyle(GREY))
    this.scene.tweens.killTweensOf(o)
    o.setPosition(this.x + dir.x * 6, this.y + dir.y * 6).setScale(1.2, 0.85)
    this.scene.tweens.add({ targets: o, x: this.x, y: this.y, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' })
    sfx.targetHit()

    if (this.hp <= 0) {
      this.alive = false
      o.setVisible(false)
      burst(this.scene, this.x, this.y, { count: 12, colour: GREY, angle: 0, spread: Math.PI, speed: [120, 320], size: [5, 10], life: 360 })
      ring(this.scene, this.x, this.y, this.radius * 2, this.radius * 2, 0xffffff, { grow: 2, life: 260 })
      sfx.targetPop()
      this.scene.time.delayedCall(DUMMY.respawn * 1000, () => this.respawn())
    }
  }

  private respawn() {
    this.hp = DUMMY.health
    this.alive = true
    this.o.setVisible(true).setAlpha(0).setScale(0.4)
    this.scene.tweens.add({ targets: this.o, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' })
  }
}

/** One dummy floating above each of the given platforms. */
export function createPracticeTargets(scene: Phaser.Scene, spots: { x: number; y: number }[]): Target[] {
  return spots.map((s) => new Dummy(scene, s.x, s.y))
}
