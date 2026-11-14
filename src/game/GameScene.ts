import Phaser from 'phaser'
import { touchInput, type Controls } from './controls.ts'
import { sfx } from '../audio/sfx.ts'
import { burst, ring } from './fx.ts'
import { buzz } from './haptics.ts'
import { PLAYER_COLOURS, PlayerView } from './PlayerView.ts'
import { MeleeEnemy, type PlayerInfo } from './enemies/MeleeEnemy.ts'
import { buildNav, platformAt, platformBelow, type NavGraph } from './enemies/nav.ts'
import { Shooter } from './Shooter.ts'
import type { Target } from './targets.ts'
import { settingsStore } from '../settings/store.ts'
import { hudStore } from '../state/hud.ts'
import { ARENA, DASH, GRAVITY, MELEE, PLATFORMS, PLAYER, SCREEN, VIEW, WEAPONS } from './tuning.ts'

const COLOURS = {
  arena: 0x14141c,
  platform: 0x3a3a4a,
  dust: 0xb4b4c6,
  dash: PLAYER_COLOURS.dash,
}

const DOWN = Math.PI / 2

/** Respect the OS "reduce motion" setting: no screen shake. */
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private body_!: Phaser.Physics.Arcade.Body
  private keys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; jump: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key }

  private facing = 1
  private airJumpsLeft: number = PLAYER.airJumps
  private mouseDash: { x: number; y: number } | null = null

  /** Seconds left in the current dash (0 = not dashing). */
  private dashTime = 0
  private dashDir = new Phaser.Math.Vector2()
  /** Seconds until the dash can be used again. */
  private dashCooldown = 0
  private trailTimer = 0

  private view!: PlayerView
  private cooldownBar!: Phaser.GameObjects.Rectangle
  private cooldownBack!: Phaser.GameObjects.Rectangle
  private wasGrounded = true
  /** Vertical speed last frame: the collision has zeroed it by the time we see a landing. */
  private lastVelY = 0
  private skidCooldown = 0
  private darkness!: Phaser.GameObjects.Image

  /** Seconds since last on the ground (for coyote time). */
  private sinceGrounded = 0
  /** Seconds left on a remembered jump press (jump buffering). */
  private jumpBuffered = 0
  /** Seconds left falling through platforms after pressing down. */
  private dropTime = 0
  private standingOn: Phaser.GameObjects.Rectangle | null = null
  private lookAhead = 0
  private stepTimer = 0
  private motes: { o: Phaser.GameObjects.Rectangle; vx: number; vy: number; phase: number }[] = []
  private shooter!: Shooter
  /** No gun at the start of a run (#21); weapons come from upgrade offers later. */
  private armed = false
  /** Health in stages (#48). */
  private health: number = PLAYER.pips * PLAYER.stagesPerPip
  /** Seconds of post-hit invulnerability left (#27). */
  private hurtTime = 0
  /** Seconds of freeze-frame left. */
  private hitStop = 0
  /** Targets already hit by the current dash (one hit each per dash). */
  private dashHits = new Set<Target>()
  /** Seconds of invulnerability left after a dash ended. */
  private dashGrace = 0
  /**
   * Taking turns (#49): only one enemy may wind up or lunge at a time. The rest
   * keep their distance until it's done, then a short gap before the next.
   */
  private turns = {
    holder: null as MeleeEnemy | null,
    gap: 0,
    request: (e: MeleeEnemy) => {
      const t = this.turns
      if (t.holder && t.holder !== e && t.holder.alive) return false
      if (t.holder !== e && t.gap > 0) return false
      t.holder = e
      return true
    },
    release: (e: MeleeEnemy) => {
      const t = this.turns
      if (t.holder !== e) return
      t.holder = null
      t.gap = MELEE.turnGap
    },
    isOthers: (e: MeleeEnemy) => !!this.turns.holder && this.turns.holder !== e && this.turns.holder.alive,
  }
  /** Zoom that fills the screen (#35); the target zoom-out (#44) scales it down. */
  private baseZoom = 1
  private minZoom = 0.1
  private zoomFactor = 1
  private enemies: MeleeEnemy[] = []
  private enemyGroup!: Phaser.Physics.Arcade.Group
  private nav!: NavGraph
  private playerInfo: PlayerInfo = { x: 0, y: 0, platform: -1 }
  /** Temporary spawner until waves exist: seconds until the next spawn. */
  private spawnTimer = 0.5
  private spawnKey!: Phaser.Input.Keyboard.Key
  /** Everything that can be hit or auto-aimed at. */
  private get targets(): Target[] {
    return this.enemies
  }

  /** True while the player can't be hurt. Enemies will check this (#24, #27). */
  get invulnerable() {
    return this.dashTime > 0 || this.hurtTime > 0 || this.dashGrace > 0
  }
  get dashing() {
    return this.dashTime > 0
  }

  constructor() {
    super('game')
  }

  create() {
    this.physics.world.gravity.y = GRAVITY
    this.physics.world.setBounds(0, 0, ARENA.width, ARENA.height)

    this.add.rectangle(0, 0, ARENA.width, ARENA.height, COLOURS.arena).setOrigin(0)

    this.createMotes()

    const platforms = this.physics.add.staticGroup()
    for (const p of PLATFORMS) {
      const r = this.add.rectangle(p.x, p.y, p.w, p.h, COLOURS.platform).setOrigin(0)
      platforms.add(r)
      r.setData('baseY', p.y)
      if (!p.solid) {
        // One-way: only the top is solid, so you can jump up through from below.
        const pb = r.body as Phaser.Physics.Arcade.StaticBody
        pb.checkCollision.down = false
        pb.checkCollision.left = false
        pb.checkCollision.right = false
        r.setData('oneWay', true)
      }
    }

    // Physics box: invisible. What you see is PlayerView, which squashes and stretches.
    this.darkness = this.createDarkness()

    this.player = this.add.rectangle(ARENA.width / 2, ARENA.height - 120, PLAYER.size, PLAYER.size, 0xffffff).setVisible(false)
    this.view = new PlayerView(this)

    // Desktop dash cooldown: a thin bar under the square, hidden when ready.
    this.cooldownBack = this.add.rectangle(0, 0, PLAYER.size, 6, 0xffffff, 0.12).setOrigin(0, 0.5).setDepth(9)
    this.cooldownBar = this.add.rectangle(0, 0, PLAYER.size, 6, COLOURS.dash, 0.9).setOrigin(0, 0.5).setDepth(9)
    this.physics.add.existing(this.player)

    // Shooting. Bullets pass through platforms; only the floor stops them (#42).
    const floorY = PLATFORMS.find((p) => p.solid)?.y ?? ARENA.height
    this.shooter = new Shooter(this, floorY, () => this.targets)

    // Enemies (#40): route-finding graph, a physics group so they bump each other,
    // and platform collisions that let them drop through one-way platforms.
    this.nav = buildNav(PLATFORMS)
    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true })
    this.physics.add.collider(this.enemyGroup, this.enemyGroup)
    this.physics.add.collider(this.enemyGroup, platforms, undefined, (eo, plat) => {
      const e = (eo as Phaser.GameObjects.Arc).getData('enemy') as MeleeEnemy | undefined
      return !(e && e.dropping > 0 && (plat as Phaser.GameObjects.Rectangle).getData('oneWay'))
    })
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body
    this.body_.setCollideWorldBounds(true)
    this.physics.add.collider(
      this.player,
      platforms,
      (_pl, plat) => {
        if (this.body_.touching.down) this.standingOn = plat as Phaser.GameObjects.Rectangle
      },
      // While dropping through, one-way platforms don't collide.
      (_pl, plat) => !(this.dropTime > 0 && (plat as Phaser.GameObjects.Rectangle).getData('oneWay')),
    )

    const kb = this.input.keyboard!
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    }
    // Temporary: E spawns an extra enemy (desktop), for testing crowds.
    this.spawnKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E)

    // Right-click dashes (#21): towards the mouse in Manual; auto modes decide in readControls.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !p.rightButtonDown()) return
      this.mouseDash = { x: p.worldX - this.player.x, y: p.worldY - this.player.y }
    })
    hudStore.set({ health: this.health, pips: PLAYER.pips, stagesPerPip: PLAYER.stagesPerPip })

    const cam = this.cameras.main
    cam.setBounds(0, 0, ARENA.width, ARENA.height)
    cam.startFollow(this.player, false, SCREEN.followLerp, SCREEN.followLerp)
    this.fitCamera()
    cam.centerOn(this.player.x, this.player.y)
    this.scene.launch('markers')
    this.scene.launch('touch')
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this))
  }

  /**
   * Fill the whole screen, whatever its shape. Zoom is set so the screen would
   * show a 1600×900 area, then pulled out by VIEW.zoom; the camera follows the
   * player around the (bigger) arena.
   */
  private fitCamera() {
    const cam = this.cameras.main
    const { width, height } = this.scale
    cam.setSize(width, height)
    const baseline = Math.max(width / VIEW.baseWidth, height / VIEW.baseHeight)
    // Never so far out that the view is bigger than the arena.
    this.minZoom = Math.max(width / ARENA.width, height / ARENA.height)
    this.baseZoom = Math.max(baseline * VIEW.zoom, this.minZoom)
    cam.setZoom(Math.max(this.baseZoom * this.zoomFactor, this.minZoom))
  }

  private readControls(): Controls {
    let moveX = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0)
    if (moveX === 0) moveX = touchInput.moveX
    const jump = Phaser.Input.Keyboard.JustDown(this.keys.jump) || touchInput.jumpQueued
    touchInput.jumpQueued = false

    // Dash direction. In the auto-aim modes the dash goes for the target, unless
    // you're already moving somewhere. {0,0} means "the way you're facing".
    const auto = settingsStore.aimMode !== 'manual'
    const t = this.shooter?.target
    const toTarget = auto && t ? { x: t.x - this.player.x, y: t.y - this.player.y } : null
    let dash: Controls['dash'] = null
    if (this.mouseDash) {
      // Desktop: Manual → towards the mouse. Auto → A/D direction if held, else the target.
      dash = !auto ? this.mouseDash : moveX !== 0 ? { x: moveX, y: 0 } : (toTarget ?? { x: 0, y: 0 })
      this.mouseDash = null
    }
    if (touchInput.dashQueued) {
      // Touch: the way the joystick points; with the stick idle, the target (auto modes) or facing.
      const pushed = Math.hypot(touchInput.stickX, touchInput.stickY) > 0.3
      dash = pushed ? { x: touchInput.stickX, y: touchInput.stickY } : (toTarget ?? { x: 0, y: 0 })
      touchInput.dashQueued = false
    }
    const down = this.keys.down.isDown || touchInput.stickY > 0.6
    return { moveX, jump, down, dash }
  }

  update(_time: number, deltaMs: number) {
    // Freeze-frame: physics paused, nothing moves, for a few hundredths of a second.
    if (this.hitStop > 0) {
      this.hitStop -= deltaMs / 1000
      if (this.hitStop <= 0) this.physics.world.resume()
      return
    }
    const c = this.readControls()
    const dt = deltaMs / 1000
    this.hurtTime = Math.max(0, this.hurtTime - dt)
    this.dashGrace = Math.max(0, this.dashGrace - dt)
    this.view.flicker = this.hurtTime > 0
    // Same camera smoothing whatever the screen's refresh rate.
    const lerp = 1 - Math.pow(1 - SCREEN.followLerp, dt * 60)
    this.cameras.main.setLerp(lerp, lerp)
    const b = this.body_
    const grounded = b.blocked.down || b.touching.down
    const feetY = b.bottom
    if (!grounded) this.standingOn = null

    if (grounded && !this.wasGrounded && !this.dashing) this.onLand(this.lastVelY)
    if (grounded) this.airJumpsLeft = PLAYER.airJumps
    this.sinceGrounded = grounded ? 0 : this.sinceGrounded + dt
    this.jumpBuffered = c.jump ? PLAYER.jumpBuffer : Math.max(0, this.jumpBuffered - dt)
    this.dropTime = Math.max(0, this.dropTime - dt)

    // Down (or down + jump) on a one-way platform: drop through it.
    if (c.down && grounded && this.standingOn?.getData('oneWay') && !this.dashing) {
      this.dropTime = PLAYER.dropThrough
      this.jumpBuffered = 0
      this.sinceGrounded = PLAYER.coyoteTime // no coyote jump off the platform you just left
      b.setVelocityY(Math.max(b.velocity.y, 120))
      this.view.kick(1.15, 0.85)
    }

    // Skid: turning round at speed on the ground kicks up dust.
    this.skidCooldown = Math.max(0, this.skidCooldown - dt)
    if (grounded && !this.dashing && c.moveX !== 0 && Math.sign(c.moveX) !== Math.sign(b.velocity.x) && Math.abs(b.velocity.x) > PLAYER.runSpeed * 0.6 && this.skidCooldown === 0) {
      this.skidCooldown = 0.25
      burst(this, this.player.x, feetY - 3, { count: 5, colour: COLOURS.dust, angle: b.velocity.x > 0 ? -0.4 : Math.PI + 0.4, spread: 0.3, speed: [120, 260], size: [5, 9], gravity: -60 })
      sfx.skid()
    }

    // Footstep ticks while running on the ground.
    if (grounded && !this.dashing && Math.abs(b.velocity.x) > PLAYER.runSpeed * 0.5) {
      this.stepTimer -= dt
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.26
        sfx.step()
      }
    } else {
      this.stepTimer = 0.1
    }
    if (c.moveX !== 0) this.facing = Math.sign(c.moveX)

    const wasCooling = this.dashCooldown > 0
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    if (wasCooling && this.dashCooldown === 0) this.onDashReady()
    if (c.dash && this.dashCooldown === 0 && !this.dashing) this.startDash(c.dash)

    if (this.dashing) {
      this.updateDash(dt)
    } else {
      const target = c.moveX * PLAYER.runSpeed
      const t = Math.min(1, dt * PLAYER.responsiveness)
      b.setVelocityX(b.velocity.x + (target - b.velocity.x) * t)

      // Ground jump: on the ground, or just after leaving it (coyote time); a press
      // just before landing also counts (buffer). Otherwise a fresh press in the air double jumps.
      const canGroundJump = grounded || this.sinceGrounded < PLAYER.coyoteTime
      const wantsJump = this.jumpBuffered > 0 && !(c.down && this.dropTime > 0)
      if (wantsJump && (canGroundJump || c.jump)) {
        this.jumpBuffered = 0
        if (canGroundJump) {
          this.sinceGrounded = PLAYER.coyoteTime
          sfx.jump()
          b.setVelocityY(-PLAYER.jumpSpeed)
          this.view.kick(0.72, 1.32)
          burst(this, this.player.x, feetY - 3, { count: 6, colour: COLOURS.dust, angle: -DOWN, spread: 1.2, speed: [60, 160], size: [5, 9], gravity: 200 })
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft--
          sfx.airJump()
          b.setVelocityY(-PLAYER.jumpSpeed * PLAYER.airJumpScale)
          this.view.kick(0.8, 1.22)
          ring(this, this.player.x, feetY, PLAYER.size * 1.2, PLAYER.size * 0.35, 0xffffff)
        }
      }
    }

    touchInput.dashReady = 1 - this.dashCooldown / DASH.cooldown

    this.view.update(dt, {
      x: this.player.x,
      bottom: feetY,
      centreY: this.player.y,
      velX: b.velocity.x,
      velY: b.velocity.y,
      grounded,
      dashing: this.dashing,
      dashAngle: this.dashDir.angle(),
    })

    // Cooldown bar (desktop only; touch has the ring on its DASH button).
    const showBar = this.dashCooldown > 0 && !touchInput.controlsShown
    const barY = feetY + 10
    const left = this.player.x - PLAYER.size / 2
    this.cooldownBack.setVisible(showBar).setPosition(left, barY)
    this.cooldownBar.setVisible(showBar).setPosition(left, barY).setScale(touchInput.dashReady, 1)

    this.wasGrounded = grounded
    this.lastVelY = b.velocity.y

    this.updateEnemies(dt)
    this.updateShooting(dt)
    this.checkContacts()
    this.updateTargetZoom(dt)
    this.updateLookAhead(dt)
    this.updateDarkness()
    this.updateMotes(dt)
  }

  private updateShooting(dt: number) {
    const cam = this.cameras.main
    const touch = touchInput.controlsShown
    const mouse = this.input.mousePointer
    const mode = settingsStore.aimMode

    let fireHeld = false
    let aimPoint: { x: number; y: number } | null = null
    if (touch) {
      fireHeld = touchInput.fireHeld
      if (fireHeld) aimPoint = cam.getWorldPoint(touchInput.fireX, touchInput.fireY)
    } else if (mouse) {
      fireHeld = mouse.leftButtonDown()
      aimPoint = cam.getWorldPoint(mouse.x, mouse.y)
    }
    const desktopManual = !touch && mode === 'manual'
    this.game.canvas.style.cursor = desktopManual ? 'none' : ''

    const shot = this.shooter.update(dt, {
      x: this.player.x,
      y: this.player.y,
      facing: this.facing,
      dashing: this.dashing,
      armed: this.armed,
      mode,
      fireHeld,
      aimPoint,
      pxToWorld: 1 / cam.zoom,
      crosshair: desktopManual && aimPoint ? aimPoint : null,
    })
    if (shot) {
      // Small recoil: mostly sideways; a little lift if firing downwards in the air.
      const b = this.body_
      b.setVelocityX(b.velocity.x - shot.x * WEAPONS.pistol.recoil)
      if (!b.blocked.down) b.setVelocityY(b.velocity.y - shot.y * WEAPONS.pistol.recoil * 0.5)
      this.view.kick(1 - Math.abs(shot.x) * 0.06, 1 - Math.abs(shot.y) * 0.06)
    }
  }

  private updateEnemies(dt: number) {
    const b = this.body_
    const grounded = b.blocked.down || b.touching.down
    const plat = grounded ? platformAt(this.nav, this.player.x, b.bottom) : -1
    this.playerInfo.x = this.player.x
    this.playerInfo.y = this.player.y
    this.playerInfo.platform = plat >= 0 ? plat : platformBelow(this.nav, this.player.x, b.bottom)

    this.turns.gap = Math.max(0, this.turns.gap - dt)
    if (this.turns.holder && !this.turns.holder.alive) this.turns.holder = null
    for (const e of this.enemies) e.update(dt, this.playerInfo)
    this.enemies = this.enemies.filter((e) => e.state !== 'dead')

    // Temporary spawner (until waves): keep a couple in the arena; E adds one.
    if (Phaser.Input.Keyboard.JustDown(this.spawnKey)) this.spawnEnemy()
    if (this.enemies.length < MELEE.keepAlive) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        this.spawnEnemy()
        this.spawnTimer = MELEE.respawnDelay
      }
    }
  }

  /** On a random platform, preferably well away from the player. */
  private spawnEnemy() {
    const far = PLATFORMS.filter((p) => Math.abs(p.x + p.w / 2 - this.player.x) + Math.abs(p.y - this.player.y) > 600)
    const pool = far.length ? far : [...PLATFORMS]
    const p = pool[Phaser.Math.Between(0, pool.length - 1)]
    const x = Phaser.Math.Between(p.x + 40, p.x + p.w - 40)
    const e = new MeleeEnemy(this, x, p.y - MELEE.radius - 2, this.nav, () => this.onKill(), this.turns)
    this.enemyGroup.add(e.o)
    ;(e.o.body as Phaser.Physics.Arcade.Body).setCircle(MELEE.radius).setCollideWorldBounds(true)
    ;(e.o.body as Phaser.Physics.Arcade.Body).enable = false
    this.enemies.push(e)
  }

  /**
   * Player vs targets. Dashing through one hits it (once per dash, #24);
   * otherwise touching one hurts you (#23) unless you're invulnerable.
   */
  private checkContacts() {
    const b = this.body_
    for (const t of this.targets) {
      if (!t.alive) continue
      const nx = Phaser.Math.Clamp(t.x, b.left, b.right)
      const ny = Phaser.Math.Clamp(t.y, b.top, b.bottom)
      if (Phaser.Math.Distance.Between(nx, ny, t.x, t.y) > t.radius) continue
      if (this.dashing) {
        if (this.dashHits.has(t)) continue
        this.dashHits.add(t)
        t.hit(1, { x: this.dashDir.x, y: this.dashDir.y })
        sfx.dashHit()
        buzz(25)
        this.shake(80, 0.004)
        burst(this, t.x, t.y, { count: 8, colour: 0xffffff, angle: this.dashDir.angle(), spread: 0.8, speed: [150, 380], size: [4, 8], life: 220 })
        this.freeze(PLAYER.dashHitStop)
      } else if (!this.invulnerable) {
        this.takeHit(t.x, t.attacking)
        return
      }
    }
  }

  /** A kill counts towards healing one pip, unless you're already at full health (#47). */
  /** Each kill restores one stage (#48); wasted at full health. A pip refilling gets the bigger effect. */
  private onKill() {
    const max = PLAYER.pips * PLAYER.stagesPerPip
    if (this.health >= max) return
    this.health += 1
    const pipDone = this.health % PLAYER.stagesPerPip === 0
    if (pipDone) {
      this.healEffect()
      const hud = hudStore.get()
      hudStore.set({ health: this.health, healCount: hud.healCount + 1, healedPip: this.health / PLAYER.stagesPerPip - 1 })
    } else {
      ring(this, this.player.x, this.player.y, PLAYER.size * 1.1, PLAYER.size * 1.1, 0xffffff, { grow: 1.6, life: 260, alpha: 0.5 })
      sfx.dashReady()
      hudStore.set({ health: this.health })
    }
  }


  private healEffect() {
    const { x, y } = this.player
    this.view.pulse(0.25)
    ring(this, x, y, PLAYER.size * 1.3, PLAYER.size * 1.3, 0xffffff, { grow: 2.4, life: 420, alpha: 0.8 })
    burst(this, x, y + PLAYER.size * 0.3, { count: 10, colour: 0xffffff, angle: -DOWN, spread: 0.7, speed: [80, 200], size: [4, 7], life: 520, gravity: -150 })
    sfx.heal()
    buzz(20)
  }

  private freeze(seconds: number) {
    this.hitStop = Math.max(this.hitStop, seconds)
    this.physics.world.pause()
  }

  /** Knockback, lose a hit point, short invulnerability (#23, #27). */
  /**
   * Getting hurt (#48). An attack (a lunge) costs a whole pip with full feedback
   * and knockback; brushing an enemy costs one stage with a lighter version.
   */
  private takeHit(fromX: number, attack: boolean) {
    const max = PLAYER.pips * PLAYER.stagesPerPip
    this.health -= attack ? PLAYER.attackDamage : PLAYER.contactDamage
    this.hurtTime = attack ? PLAYER.hurtInvulnerability : PLAYER.contactInvulnerability
    const away = Math.sign(this.player.x - fromX) || -this.facing
    const hud = hudStore.get()
    if (attack) {
      this.body_.setVelocity(away * PLAYER.hurtKnockback.x, -PLAYER.hurtKnockback.y)
      this.view.kick(1.35, 0.7)
      this.view.pulse(0.12)
      burst(this, this.player.x, this.player.y, { count: 12, colour: 0xff5a5a, angle: 0, spread: Math.PI, speed: [150, 380], size: [4, 9], life: 320 })
      this.shake(170, 0.012)
      sfx.hurt()
      buzz(80)
      this.freeze(PLAYER.hurtHitStop)
    } else {
      // A scrape: small nudge, small effects, no freeze, no red pulse.
      this.body_.setVelocityX(this.body_.velocity.x + away * 220)
      this.view.kick(1.12, 0.9)
      burst(this, this.player.x, this.player.y, { count: 5, colour: 0xff8a8a, angle: 0, spread: Math.PI, speed: [100, 220], size: [3, 6], life: 220 })
      this.shake(70, 0.004)
      sfx.enemyHit()
      buzz(25)
    }
    if (this.health <= 0) {
      // Temporary until runs exist: refill and carry on.
      this.health = max
      this.hurtTime = PLAYER.hurtInvulnerability * 1.5
      ring(this, this.player.x, this.player.y, PLAYER.size * 2, PLAYER.size * 2, 0xffffff, { grow: 4, life: 600, line: 5 })
      this.time.delayedCall(120, () => sfx.revive())
      hudStore.set({ health: this.health, hurtCount: hud.hurtCount + 1, deathCount: hud.deathCount + 1 })
    } else {
      hudStore.set({ health: this.health, hurtCount: attack ? hud.hurtCount + 1 : hud.hurtCount })
    }
  }


  /** For the marker overlay. */
  get markerInfo() {
    return { targets: this.targets, target: this.shooter.target, player: this.player }
  }

  /**
   * Target off screen (judged at the normal zoom, so it doesn't see-saw):
   * zoom out just enough to bring it in, up to VIEW.targetZoomOut (#44).
   */
  private updateTargetZoom(dt: number) {
    const cam = this.cameras.main
    const t = this.shooter.target
    let want = 1
    if (t) {
      const cx = cam.midPoint.x
      const cy = cam.midPoint.y
      const margin = t.radius + 40
      const halfW = cam.width / this.baseZoom / 2
      const halfH = cam.height / this.baseZoom / 2
      const dx = Math.abs(t.x - cx) + margin
      const dy = Math.abs(t.y - cy) + margin
      if (dx > halfW || dy > halfH) {
        const needed = Math.min(halfW / dx, halfH / dy)
        want = Math.max(1 - VIEW.targetZoomOut, needed)
      }
    }
    const speed = want < this.zoomFactor ? VIEW.zoomOutSpeed : VIEW.zoomInSpeed
    this.zoomFactor += (want - this.zoomFactor) * Math.min(1, dt * speed)
    cam.setZoom(Math.max(this.baseZoom * this.zoomFactor, this.minZoom))
  }

  /** The camera leads a little in the direction you're running. */
  private updateLookAhead(dt: number) {
    const cam = this.cameras.main
    const v = this.body_.velocity.x / PLAYER.runSpeed
    const target = Phaser.Math.Clamp(v, -1, 1) * (cam.width / cam.zoom) * SCREEN.lookAhead
    this.lookAhead += (target - this.lookAhead) * Math.min(1, dt * SCREEN.lookAheadSpeed)
    // followOffset is subtracted from the target, so negative looks ahead to the right.
    cam.setFollowOffset(-this.lookAhead, 0)
  }

  /** Faint specks drifting in the air, under the darkness so they only show near the light. */
  private createMotes() {
    for (let i = 0; i < SCREEN.motes; i++) {
      const s = Phaser.Math.FloatBetween(3, 7)
      const o = this.add
        .rectangle(Phaser.Math.Between(0, ARENA.width), Phaser.Math.Between(0, ARENA.height), s, s, 0xdcdcf0, Phaser.Math.FloatBetween(0.12, 0.35))
        .setDepth(3)
        .setAngle(Phaser.Math.Between(0, 90))
      this.motes.push({ o, vx: Phaser.Math.FloatBetween(-12, 12), vy: Phaser.Math.FloatBetween(-22, -6), phase: Math.random() * Math.PI * 2 })
    }
  }

  private updateMotes(dt: number) {
    const t = this.time.now / 1000
    for (const m of this.motes) {
      m.o.x += (m.vx + Math.sin(t * 0.7 + m.phase) * 10) * dt
      m.o.y += m.vy * dt
      m.o.angle += m.vx * dt
      if (m.o.y < -10) m.o.y = ARENA.height + 10
      if (m.o.x < -10) m.o.x = ARENA.width + 10
      else if (m.o.x > ARENA.width + 10) m.o.x = -10
    }
  }

  /** Landing on a platform: it dips and brightens for a moment (visual only). */
  private platformReact(k: number) {
    const plat = this.standingOn
    if (!plat || plat.getData('busy')) return
    const baseY = plat.getData('baseY') as number
    plat.setData('busy', true)
    const flash = this.add.rectangle(plat.x, baseY, plat.width, plat.height, 0xffffff, 0.12 + 0.18 * k).setOrigin(0).setDepth(1)
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() })
    this.tweens.add({
      targets: [plat, flash],
      y: baseY + 2 + 4 * k,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        plat.y = baseY
        plat.setData('busy', false)
      },
    })
  }

  /**
   * A big radial gradient: clear in the middle, dark towards the edge, solid
   * dark beyond. Drawn once; scaled and moved with the player each frame.
   */
  private createDarkness() {
    const key = 'darkness'
    if (!this.textures.exists(key)) {
      const size = 512
      const tex = this.textures.createCanvas(key, size, size)!
      const ctx = tex.getContext()
      const c = size / 2
      // The gradient reaches full darkness at half the texture's radius; the rest is solid.
      const g = ctx.createRadialGradient(c, c, 0, c, c, c / 2)
      const { clear, edge } = SCREEN.light
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(clear, 'rgba(0,0,0,0)')
      g.addColorStop(clear + (1 - clear) * 0.5, `rgba(0,0,0,${edge * 0.55})`)
      g.addColorStop(1, `rgba(0,0,0,${edge})`)
      // Canvas gradients carry the last colour on past their radius, so this fills the rest solid.
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      tex.refresh()
    }
    // Above the arena and platforms (depth 0), below effects (5+) and the player (10).
    return this.add.image(0, 0, key).setDepth(4)
  }

  private updateDarkness() {
    const cam = this.cameras.main
    // Radius in world units, relative to what's on screen, so it looks the same at any zoom.
    const diag = Math.hypot(cam.width, cam.height) / cam.zoom
    const r = diag * SCREEN.light.radius
    // The texture's gradient ends at half its size, so draw it 4r across.
    this.darkness.setPosition(this.player.x, this.player.y).setDisplaySize(r * 4, r * 4)
  }

  /** Squash and dust, scaled by how hard you hit the ground. */
  private onLand(impactVelY: number) {
    const k = Phaser.Math.Clamp((impactVelY - 200) / 1400, 0, 1)
    if (k <= 0) return
    sfx.land(k)
    buzz(8 + 22 * k)
    this.platformReact(k)
    this.view.kick(1 + 0.4 * k, 1 - 0.4 * k)
    const feetY = this.body_.bottom
    const n = Math.round(3 + 6 * k)
    if (k > 0.35) this.shake(SCREEN.landShake.duration, SCREEN.landShake.intensity * k)
    burst(this, this.player.x - PLAYER.size * 0.3, feetY - 3, { count: n, colour: COLOURS.dust, angle: Math.PI + 0.3, spread: 0.25, speed: [90, 120 + 220 * k], size: [5, 9], gravity: -120 })
    burst(this, this.player.x + PLAYER.size * 0.3, feetY - 3, { count: n, colour: COLOURS.dust, angle: -0.3, spread: 0.25, speed: [90, 120 + 220 * k], size: [5, 9], gravity: -120 })
  }

  private shake(duration: number, intensity: number) {
    if (reduceMotion()) return
    this.cameras.main.shake(duration, intensity, true)
  }

  /** The dash is back: flash and a ring, so you notice without looking for the bar. */
  private onDashReady() {
    this.view.pulse()
    sfx.dashReady()
    ring(this, this.player.x, this.player.y, PLAYER.size * 1.1, PLAYER.size * 1.1, COLOURS.dash, { grow: 1.7, life: 280, alpha: 0.7 })
  }

  private startDash(dir: { x: number; y: number }) {
    this.dashDir.set(dir.x, dir.y)
    if (this.dashDir.lengthSq() < 1e-6) this.dashDir.set(this.facing, 0)
    this.dashDir.normalize()
    if (Math.abs(this.dashDir.x) > 0.1) this.facing = Math.sign(this.dashDir.x)

    this.dashTime = DASH.duration
    this.dashCooldown = DASH.cooldown
    this.body_.setAllowGravity(false)
    this.trailTimer = 0
    this.dashHits.clear()
    sfx.dash()
    burst(this, this.player.x, this.player.y, {
      count: 10, colour: COLOURS.dash, angle: this.dashDir.angle() + Math.PI, spread: 0.6, speed: [180, 420], size: [5, 10], life: 280,
    })
  }

  private updateDash(dt: number) {
    // Hit something mid-dash: flatten against it and stop the dash.
    const bl = this.body_.blocked
    const hit = (bl.left && this.dashDir.x < -0.3) || (bl.right && this.dashDir.x > 0.3) || (bl.up && this.dashDir.y < -0.3) || (bl.down && this.dashDir.y > 0.3)
    if (hit && this.dashTime < DASH.duration - 0.02) {
      this.endDash(0)
      this.shake(SCREEN.dashImpactShake.duration, SCREEN.dashImpactShake.intensity)
      sfx.dashImpact()
      buzz(35)
      if (bl.left || bl.right) this.view.kick(0.6, 1.3)
      else this.view.kick(1.4, 0.65)
      const x = bl.left ? this.body_.left : bl.right ? this.body_.right : this.player.x
      const y = bl.up ? this.body_.top : bl.down ? this.body_.bottom : this.player.y
      const away = bl.left ? 0 : bl.right ? Math.PI : bl.up ? DOWN : -DOWN
      burst(this, x, y, { count: 7, colour: COLOURS.dash, angle: away, spread: 1.1, speed: [120, 300], size: [4, 8], life: 260 })
      return
    }

    this.body_.setVelocity(this.dashDir.x * DASH.speed, this.dashDir.y * DASH.speed)

    this.trailTimer -= dt
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.025
      // Afterimage matching the stretched streak.
      const v = this.view.rect
      const ghost = this.add
        .rectangle(this.player.x, this.player.y, PLAYER.size, PLAYER.size, COLOURS.dash, 0.45)
        .setDepth(5)
        .setRotation(this.dashDir.angle())
        .setScale(v.scaleX, v.scaleY)
      this.tweens.add({ targets: ghost, alpha: 0, scaleX: v.scaleX * 0.6, scaleY: v.scaleY * 0.6, duration: 220, onComplete: () => ghost.destroy() })
    }

    this.dashTime -= dt
    if (this.dashTime <= 0) this.endDash(DASH.carry)
  }

  private endDash(carry: number) {
    this.dashTime = 0
    this.dashGrace = DASH.grace
    this.body_.setAllowGravity(true)
    this.body_.setVelocity(this.dashDir.x * DASH.speed * carry, this.dashDir.y * DASH.speed * carry)
    // Come out of the streak a little stretched along the way you were going.
    if (Math.abs(this.dashDir.x) > Math.abs(this.dashDir.y)) this.view.kick(1.25, 0.8)
    else this.view.kick(0.8, 1.25)
  }
}
