import Phaser from 'phaser'
import { touchInput, type Controls } from './controls.ts'
import { ARENA, GRAVITY, PLATFORMS, PLAYER } from './tuning.ts'

const COLOURS = {
  arena: 0x14141c,
  platform: 0x3a3a4a,
  player: 0xf2f2f2,
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private body_!: Phaser.Physics.Arcade.Body
  private keys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; jump: Phaser.Input.Keyboard.Key }

  constructor() {
    super('game')
  }

  create() {
    this.physics.world.gravity.y = GRAVITY
    this.physics.world.setBounds(0, 0, ARENA.width, ARENA.height)

    this.add.rectangle(0, 0, ARENA.width, ARENA.height, COLOURS.arena).setOrigin(0)

    const platforms = this.physics.add.staticGroup()
    for (const p of PLATFORMS) {
      const r = this.add.rectangle(p.x, p.y, p.w, p.h, COLOURS.platform).setOrigin(0)
      platforms.add(r)
    }

    this.player = this.add.rectangle(ARENA.width / 2, 780, PLAYER.size, PLAYER.size, COLOURS.player)
    this.physics.add.existing(this.player)
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body
    this.body_.setCollideWorldBounds(true)
    this.physics.add.collider(this.player, platforms)

    const kb = this.input.keyboard!
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    }

    const cam = this.cameras.main
    cam.setBounds(0, 0, ARENA.width, ARENA.height)
    cam.startFollow(this.player, false, 0.12, 0.12)
    this.fitCamera()
    cam.centerOn(this.player.x, this.player.y)
    this.scene.launch('touch')
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this))
  }

  /**
   * Fill the whole screen, whatever its shape: zoom until the arena covers it,
   * then follow the player within the arena. On screens close to 16:9 you see
   * (nearly) all of it; on narrow or very wide screens you see a zoomed-in slice.
   */
  private fitCamera() {
    const cam = this.cameras.main
    const { width, height } = this.scale
    cam.setSize(width, height)
    cam.setZoom(Math.max(width / ARENA.width, height / ARENA.height))
  }

  private readControls(): Controls {
    let moveX = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0)
    if (moveX === 0) moveX = touchInput.moveX
    const jump = Phaser.Input.Keyboard.JustDown(this.keys.jump) || touchInput.jumpQueued
    touchInput.jumpQueued = false
    return { moveX, jump }
  }

  update(_time: number, deltaMs: number) {
    const c = this.readControls()
    const dt = deltaMs / 1000

    const target = c.moveX * PLAYER.runSpeed
    const t = Math.min(1, dt * PLAYER.responsiveness)
    this.body_.setVelocityX(this.body_.velocity.x + (target - this.body_.velocity.x) * t)

    const grounded = this.body_.blocked.down || this.body_.touching.down
    if (c.jump && grounded) this.body_.setVelocityY(-PLAYER.jumpSpeed)
  }
}
