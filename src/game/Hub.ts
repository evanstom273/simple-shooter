import Phaser from 'phaser'
import { sfx } from '../audio/sfx.ts'
import { OFFER_INFO, progressStore, type Offer } from '../state/progress.ts'
import { burst, ring } from './fx.ts'
import { HUB } from './levels.ts'
import type { HitSource } from './targets.ts'
import type { Enemy, PlayerInfo } from './enemies/types.ts'

// The hub (#70), ported from the approved mock-up (concepts/hub-mockup.html):
// an eerie liminal hall with colossal pillars fading into fog, a pale shaft of
// light on the shop pedestals, four world portals in the wings, the endless
// portal in a chamber below, and a training dummy.

const FONT = '"Space Grotesk", Inter, system-ui, sans-serif'
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0')

type Shape = 'hex' | 'diamond' | 'triangle' | 'circle' | 'square'

function shapePoints(shape: Shape, r: number): Phaser.Math.Vector2[] {
  if (shape === 'circle') return Array.from({ length: 40 }, (_, i) => new Phaser.Math.Vector2(Math.cos((i / 40) * Math.PI * 2) * r, Math.sin((i / 40) * Math.PI * 2) * r))
  const sides = shape === 'hex' ? 6 : shape === 'triangle' ? 3 : 4
  const off = shape === 'hex' ? Math.PI / 6 : shape === 'triangle' ? -Math.PI / 2 : shape === 'diamond' ? -Math.PI / 2 : Math.PI / 4
  const sy = shape === 'diamond' ? 1.25 : 1
  return Array.from({ length: sides }, (_, i) => {
    const a = off + (i / sides) * Math.PI * 2
    return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r * sy)
  })
}

export interface HubEvents {
  enterWorld(world: 1 | 2 | 3 | 4): void
  enterEndless(): void
  /** Pedestal i (0–2 offers, 3 = reroll) asked to buy; returns whether it happened. */
  buy(i: number): boolean
}

export class Hub {
  private scene: Phaser.Scene
  private far: Phaser.GameObjects.Graphics
  private glow: Phaser.GameObjects.Graphics
  private fg: Phaser.GameObjects.Graphics
  private labels: Phaser.GameObjects.Text[] = []
  private pedestalText: { price: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; note: Phaser.GameObjects.Text }[] = []
  private endlessBest = 0
  private endlessWave = 0
  private endlessText: Phaser.GameObjects.Text
  private events: HubEvents
  private entering = false
  /** Which pedestal you're at (for the touch BUY button and prompts), or -1. */
  near = -1
  readonly dummy: TrainingDummy

  constructor(scene: Phaser.Scene, events: HubEvents) {
    this.scene = scene
    this.events = events
    this.far = scene.add.graphics().setDepth(-2).setScrollFactor(0.35, 1)
    this.glow = scene.add.graphics().setDepth(1)
    this.fg = scene.add.graphics().setDepth(6)
    this.drawStatic()

    // Labels over the portals: name, next section, (pips drawn in update).
    for (const p of HUB.portals) {
      const t = scene.add.text(p.x, HUB.floor - 400, '', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: hex(p.colour), align: 'center' }).setOrigin(0.5).setDepth(7)
      const n = scene.add.text(p.x, HUB.floor - 362, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#e6e6f2', align: 'center' }).setOrigin(0.5).setDepth(7)
      this.labels.push(t, n)
    }
    const endlessTitle = scene.add.text(HUB.endless.x, HUB.lower - 330, 'Endless', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#f2f2f2' }).setOrigin(0.5).setDepth(7)
    this.endlessText = scene.add.text(HUB.endless.x, HUB.lower - 298, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffcf4a', align: 'center' }).setOrigin(0.5).setDepth(7)
    void endlessTitle
    for (const x of HUB.pedestals) {
      this.pedestalText.push({
        price: scene.add.text(x, HUB.floor - 190, '', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffcf4a' }).setOrigin(0.5).setDepth(7),
        name: scene.add.text(x, HUB.floor - 240, '', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(7),
        note: scene.add.text(x, HUB.floor - 220, '', { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', color: '#a0a0b8' }).setOrigin(0.5).setDepth(7),
      })
    }
    scene.add.text(HUB.dummy.x, HUB.floor + 26, 'TRAINING', { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#6a6a80' }).setOrigin(0.5).setDepth(7)
    this.dummy = new TrainingDummy(scene, HUB.dummy.x, HUB.floor)
  }

  setEndlessBest(score: number, wave: number) {
    this.endlessBest = score
    this.endlessWave = wave
  }

  /** The hall: pillars into fog, a shaft of light on the shop, the chamber below. */
  private drawStatic() {
    const g = this.far
    // Colossal pillars fading into darkness (parallax layer).
    for (let x = -400; x < HUB.width * 0.35 + 2400; x += 300) {
      g.fillStyle(0x969ed2, 0.07)
      g.fillRect(x, HUB.floor - 1200, 50, 1200)
      g.fillRect(x - 10, HUB.floor - 1200, 70, 14)
    }
    for (let x = -200; x < HUB.width * 0.35 + 2400; x += 470) {
      g.fillStyle(0x969ed2, 0.045)
      g.fillRect(x, HUB.floor - 1400, 80, 1400)
    }
    const s = this.glow
    // Shaft of pale light falling on the shop.
    s.fillStyle(0xc8d2ff, 0.06)
    s.fillPoints([new Phaser.Math.Vector2(1700, -400), new Phaser.Math.Vector2(2100, -400), new Phaser.Math.Vector2(2380, HUB.floor), new Phaser.Math.Vector2(1420, HUB.floor)], true)
    // Fog along the floor.
    for (let i = 0; i < 6; i++) {
      s.fillStyle(0x7882be, 0.025)
      s.fillRect(-200, HUB.floor - 40 * (i + 1), HUB.width + 400, 40 * (i + 1))
    }
    // The chamber: darker, stiller, with its own glow.
    s.fillStyle(0x07070c, 1)
    s.fillRect(HUB.room.x, HUB.floor + HUB.slab, HUB.room.w, HUB.lower - HUB.floor - HUB.slab)
    // The hole: a soft glow rising from endless, fading upwards.
    for (let i = 0; i < 12; i++) {
      s.fillStyle(0xffffff, 0.1 * (1 - i / 12))
      s.fillRect(HUB.hole.x, HUB.floor - 10 * (i + 1), HUB.hole.w, 10)
    }
  }

  update(dt: number, player: PlayerInfo & { bottom: number }, usePressed: boolean) {
    const t = this.scene.time.now / 1000
    const g = this.fg
    g.clear()
    const prog = progressStore.get()

    // World portals.
    HUB.portals.forEach((p, i) => {
      this.drawPortal(g, p.x, HUB.floor - 150, p.shape, p.colour, 95, t)
      const done = prog.cleared[p.world]
      this.labels[i * 2].setText(p.name)
      this.labels[i * 2 + 1].setText(done >= 4 ? 'All cleared' : `Next: ${p.world}-${done + 1}`)
      for (let k = 0; k < 4; k++) {
        const x = p.x - 42 + k * 28
        const y = HUB.floor - 340
        g.fillStyle(k < done ? p.colour : 0xffffff, k < done ? 1 : 0.12)
        g.fillRect(x - 8, y, 16, 16)
      }
      if (!this.entering && Math.abs(player.x - p.x) < 60 && player.bottom > HUB.floor - 260 && player.bottom <= HUB.floor + 2) {
        this.entering = true
        this.flashInto(p.colour, p.x, HUB.floor - 150)
        this.scene.time.delayedCall(350, () => this.events.enterWorld(p.world))
      }
    })

    // Endless portal (below).
    this.drawPortal(g, HUB.endless.x, HUB.lower - 150, 'square', 0xf2f2f2, 80, t)
    this.endlessText.setText(this.endlessBest > 0 ? `Best ${this.endlessBest.toLocaleString('en-GB')} · wave ${this.endlessWave}\nstart from nothing` : 'start from nothing')
    if (!this.entering && Math.abs(player.x - HUB.endless.x) < 55 && player.bottom > HUB.lower - 230) {
      this.entering = true
      this.flashInto(0xffffff, HUB.endless.x, HUB.lower - 150)
      this.scene.time.delayedCall(350, () => this.events.enterEndless())
    }

    // Pedestals: three offers + reroll.
    this.near = -1
    if (player.bottom > HUB.floor - 140 && player.bottom <= HUB.floor + 2) {
      HUB.pedestals.forEach((x, i) => {
        if (Math.abs(player.x - x) < 52) this.near = i
      })
    }
    HUB.pedestals.forEach((x, i) => this.drawPedestal(g, x, i, prog.stock[i], prog.gold, prog.rerollPrice, t))
    if (usePressed && this.near >= 0) {
      const at = HUB.pedestals[this.near]
      if (this.events.buy(this.near)) {
        sfx.coin()
        sfx.heal()
        ring(this.scene, at, HUB.floor - 140, 70, 70, 0xffcf4a, { grow: 2.2, life: 380 })
        burst(this.scene, at, HUB.floor - 140, { count: 14, colour: 0xffcf4a, angle: -Math.PI / 2, spread: Math.PI, speed: [100, 300], size: [4, 8], life: 420 })
      } else {
        sfx.enemyHit()
      }
    }
    this.dummy.update(dt)
  }

  private flashInto(colour: number, x: number, y: number) {
    sfx.waveStart()
    ring(this.scene, x, y, 200, 200, colour, { grow: 3, life: 450, line: 6 })
    this.scene.cameras.main.flash(380, (colour >> 16) & 255, (colour >> 8) & 255, colour & 255)
  }

  private drawPortal(g: Phaser.GameObjects.Graphics, x: number, cy: number, shape: Shape, colour: number, r: number, t: number) {
    const pts = shapePoints(shape, r).map((p) => new Phaser.Math.Vector2(x + p.x, cy + p.y))
    // Light pool on the floor.
    g.fillStyle(colour, 0.1)
    g.fillEllipse(x, cy + 150, 360, 50)
    // Interior: layered, darkening inwards from a bright core.
    g.fillStyle(0x05050a, 1)
    g.fillPoints(pts, true)
    for (let k = 5; k >= 1; k--) {
      const s = k / 5
      const wob = Math.sin(t * 1.3 + k) * 4
      const inner = shapePoints(shape, r * s * 0.9).map((p) => new Phaser.Math.Vector2(x + p.x + wob, cy + p.y))
      g.fillStyle(colour, 0.12 + (1 - s) * 0.2)
      g.fillPoints(inner, true)
    }
    g.fillStyle(0xffffff, 0.85)
    g.fillCircle(x + Math.cos(t * 0.8) * 8, cy + Math.sin(t * 0.8) * 8, 7)
    // Breathing rim and a drifting echo outline.
    g.lineStyle(9, colour, 0.25 + Math.sin(t * 2 + x) * 0.1)
    g.strokePoints(pts, true, true)
    g.lineStyle(5, colour, 1)
    g.strokePoints(pts, true, true)
    const k = (t * 0.5 + x / 997) % 1
    const echo = shapePoints(shape, r * (1 + k * 0.35)).map((p) => new Phaser.Math.Vector2(x + p.x, cy + p.y))
    g.lineStyle(3, colour, 0.5 * (1 - k))
    g.strokePoints(echo, true, true)
  }

  private drawPedestal(g: Phaser.GameObjects.Graphics, x: number, i: number, o: Offer | undefined, gold: number, rerollPrice: number, t: number) {
    const F = HUB.floor
    g.fillStyle(0x23243a, 1)
    g.fillPoints([new Phaser.Math.Vector2(x - 34, F), new Phaser.Math.Vector2(x - 24, F - 80), new Phaser.Math.Vector2(x + 24, F - 80), new Phaser.Math.Vector2(x + 34, F)], true)
    g.fillStyle(0x3a3c58, 1)
    g.fillRect(x - 28, F - 84, 56, 8)
    const txt = this.pedestalText[i]
    const isReroll = i === 3
    const id = isReroll ? 'reroll' : o?.id
    if (!isReroll && (!o || o.sold)) {
      txt.price.setText(o?.sold ? 'SOLD' : '').setColor('#6a6a80')
      txt.name.setText('')
      txt.note.setText('')
      return
    }
    const info = isReroll ? { label: 'Reroll', note: 'new offers', colour: '#cfcfe0' } : OFFER_INFO[o!.id]
    const price = isReroll ? rerollPrice : o!.price
    const colour = Phaser.Display.Color.HexStringToColor(info.colour).color
    const bob = Math.sin(t * 2 + i) * 6
    const iy = F - 140 + bob
    g.fillStyle(colour, 0.12)
    g.fillCircle(x, iy, 40)
    g.fillStyle(colour, 0.08)
    g.fillCircle(x, iy, 55)
    drawIcon(g, id!, x, iy, colour)
    txt.price.setText('◆ ' + price).setY(F - 186 + bob).setColor(gold >= price ? '#ffcf4a' : '#8a6a6a')
    const near = this.near === i
    txt.name.setText(near ? info.label : '')
    txt.note.setText(near ? `${info.note} · W / ↑ to ${isReroll ? 'reroll' : 'buy'}` : '')
  }
}

function drawIcon(g: Phaser.GameObjects.Graphics, id: string, x: number, y: number, c: number) {
  g.fillStyle(c, 1)
  g.lineStyle(5, c, 1)
  const line = (pts: number[][]) => {
    g.beginPath()
    g.moveTo(x + pts[0][0], y + pts[0][1])
    for (const [px, py] of pts.slice(1)) g.lineTo(x + px, y + py)
    g.strokePath()
  }
  if (id === 'health' || id === 'heal') {
    g.fillRect(x - 6, y - 18, 12, 36)
    g.fillRect(x - 18, y - 6, 36, 12)
  } else if (id === 'jump') {
    line([[-16, 4], [0, -10], [16, 4]])
    line([[-16, 18], [0, 4], [16, 18]])
  } else if (id === 'speed') {
    line([[-18, -14], [-4, 0], [-18, 14]])
    line([[0, -14], [14, 0], [0, 14]])
  } else if (id === 'impact') {
    const pts = Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2
      const r = i % 2 ? 9 : 20
      return new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r)
    })
    g.fillPoints(pts, true)
  } else if (id.endsWith('pistol')) {
    g.fillRect(x - 18, y - 8, 30, 8)
    g.fillRect(x - 12, y, 9, 14)
  } else if (id.endsWith('automatic')) {
    g.fillRect(x - 24, y - 7, 46, 7)
    g.fillRect(x - 10, y, 8, 13)
    g.fillRect(x + 2, y, 6, 9)
  } else if (id.endsWith('shotgun')) {
    g.fillRect(x - 22, y - 11, 38, 6)
    g.fillRect(x - 22, y - 3, 38, 6)
    g.fillRect(x - 14, y + 3, 9, 12)
  } else if (id === 'reroll') {
    g.beginPath()
    g.arc(x, y, 15, 0.4, Math.PI * 1.7)
    g.strokePath()
    g.fillTriangle(x + 13, y - 16, x + 16, y - 4, x + 4, y - 4)
  }
  if (id.startsWith('improve-')) {
    g.fillRect(x + 14, y - 22, 4, 12)
    g.fillRect(x + 10, y - 18, 12, 4)
  }
}

/** A harmless dummy on a post (#70): take dashes, stomps and shots; never dies. */
export class TrainingDummy implements Enemy {
  readonly radius = 30
  readonly colour = 0x9a9ab2
  readonly damage = 0
  readonly heavy = false
  readonly attacking = false
  readonly alive = true
  readonly dead = false
  lastHitSource: HitSource = 'dash'
  readonly x: number
  readonly y: number
  private g: Phaser.GameObjects.Graphics
  private squash = 0
  private flash = 0
  private flat = 0

  constructor(scene: Phaser.Scene, x: number, floor: number) {
    this.x = x
    this.y = floor - 70
    this.g = scene.add.graphics().setDepth(7)
  }

  get hittable() {
    return this.flat <= 0
  }
  get top() {
    return this.y - this.radius
  }

  hit(_damage: number, _dir?: { x: number; y: number }, source: HitSource = 'dash') {
    if (this.flat > 0) return
    this.lastHitSource = source
    this.squash = 1
    this.flash = 0.08
    sfx.targetHit()
  }

  stomp() {
    this.hit(0, undefined, 'stomp')
    this.flat = 0.6
  }

  update(dt: number) {
    this.flat = Math.max(0, this.flat - dt)
    this.squash = Math.max(0, this.squash - dt * 3)
    this.flash = Math.max(0, this.flash - dt)
    const g = this.g
    g.clear()
    const floor = this.y + 70
    g.fillStyle(0x3a3c58, 1)
    g.fillRect(this.x - 4, floor - 40, 8, 40)
    const sq = Math.max(this.squash, this.flat > 0 ? 0.8 : 0)
    const rx = this.radius * (1 + sq * 0.4)
    const ry = this.radius * (1 - sq * 0.4)
    const cy = this.y + (this.radius - ry)
    g.fillStyle(this.flash > 0 ? 0xffffff : this.colour, 1)
    g.fillEllipse(this.x, cy, rx * 2, ry * 2)
    g.lineStyle(3, 0x1a1a26, 1)
    g.strokeEllipse(this.x, cy, rx * 2, ry * 2)
    g.lineStyle(2, 0x1a1a26, 1)
    g.strokeEllipse(this.x, cy, rx * 1.06, ry * 1.06)
    g.strokeEllipse(this.x, cy, rx * 0.34, ry * 0.34)
  }
}
