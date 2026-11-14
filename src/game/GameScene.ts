import Phaser from 'phaser'
import { touchInput, type Controls } from './controls.ts'
import { sfx } from '../audio/sfx.ts'
import { burst, ring } from './fx.ts'
import { buzz } from './haptics.ts'
import { PLAYER_COLOURS, PlayerView, type BeamBeat } from './PlayerView.ts'
import { MeleeEnemy } from './enemies/MeleeEnemy.ts'
import { RangedEnemy } from './enemies/RangedEnemy.ts'
import { TankEnemy } from './enemies/TankEnemy.ts'
import type { Enemy, Hazard, PlayerInfo, Turns } from './enemies/types.ts'
import { buildNav, platformAt, platformBelow, type NavGraph } from './enemies/nav.ts'
import { Shooter } from './Shooter.ts'
import type { HitSource, Target } from './targets.ts'
import { settingsStore } from '../settings/store.ts'
import { hudStore } from '../state/hud.ts'
import { debugBus } from '../state/debug.ts'
import { runStore } from '../state/run.ts'
import { navStore } from '../state/nav.ts'
import { arriveInHub, buy as shopBuy, progressStore, reroll as shopReroll, storyStats } from '../state/progress.ts'
import { Hub } from './Hub.ts'
import { ARENA_LEVEL, HUB, HUB_LEVEL, type Level } from './levels.ts'
import { loadScores, recordRun } from '../persist/scores.ts'
import { Gold } from './Gold.ts'
import { goldFor, maxAlive, waveOrder, waveSize, type EnemyKind } from './waves.ts'
import { ARENA, DASH, GRAVITY, MELEE, PLAYER, SCREEN, STOMP, TANK, VIEW, WAVES, WEAPONS } from './tuning.ts'

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
  private keys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; jump: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; use: Phaser.Input.Keyboard.Key; useAlt: Phaser.Input.Keyboard.Key }

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
  /** Reload bar under the player (#68), below the dash bar. */
  private reloadBack!: Phaser.GameObjects.Rectangle
  private reloadBar!: Phaser.GameObjects.Rectangle
  private weaponKeys: Phaser.Input.Keyboard.Key[] = []
  private hudWeaponsTimer = 0
  /**
   * Seconds during which your own run input doesn't steer you sideways, so a
   * push (getting hit, the shotgun's kick, bouncing off the tank) actually carries.
   */
  private pushTime = 0
  /** Dash and stomp damage multiplier: the shop's new dash/stomp upgrade (#69) raises it. */
  impactBonus = 1
  /** Health in stages (#48). */
  private health: number = PLAYER.pips * PLAYER.stagesPerPip
  /** Where we are (#62, #70): the hub, a story section, or endless mode. */
  private mode: 'hub' | 'section' | 'endless' = 'endless'
  private world: 1 | 2 | 3 | 4 = 1
  private section = 1
  private level: Level = ARENA_LEVEL
  private hub: Hub | null = null
  /** Arriving (beam-in) or leaving (beam-out / portal pull) (#75): no control, can't be hurt, waves wait. */
  private cine: 'arrive' | 'leave' | null = 'arrive'
  private afterLeave: (() => void) | null = null
  private beamG!: Phaser.GameObjects.Graphics
  /** Player stats, raised by shop upgrades in story mode (#63); endless starts from nothing (#72). */
  private runSpeed: number = PLAYER.runSpeed
  private jumpSpeed: number = PLAYER.jumpSpeed
  private pips: number = PLAYER.pips
  /** Seconds of post-hit invulnerability left (#27). */
  private hurtTime = 0
  /** Seconds of freeze-frame left. */
  private hitStop = 0
  /** Targets already hit by the current dash (one hit each per dash). */
  private dashHits = new Set<Target>()
  /** Seconds of invulnerability left after a dash ended. */
  private dashGrace = 0
  /** The player's feet last frame, for judging stomps from above (#59). */
  private prevBottom = 0
  /**
   * Taking turns (#49): only one enemy may wind up or lunge at a time. The rest
   * keep their distance until it's done, then a short gap before the next.
   */
  /** Zoom that fills the screen (#35); the target zoom-out (#44) scales it down. */
  private baseZoom = 1
  private minZoom = 0.1
  private zoomFactor = 1
  /** Melee and ranged share one attack turn (#49, #56); the tank has its own (#58). */
  private turns = makeTurns(MELEE.turnGap)
  private tankTurns = makeTurns(0)
  private enemies: Enemy[] = []
  /** Shots and shockwaves: hurt the player on touch. */
  private hazards: Hazard[] = []
  private enemyGroup!: Phaser.Physics.Arcade.Group
  private nav!: NavGraph
  private playerInfo: PlayerInfo = { x: 0, y: 0, vx: 0, vy: 0, platform: -1, view: new Phaser.Geom.Rectangle() }
  /** Waves (#13, #18): enemies still to spawn this wave, and the gap timer. */
  private waveQueue: EnemyKind[] = []
  private waveSpawnTimer = 0
  /** Enemies that belong to the current wave (test spawns don't count towards clearing it). */
  private waveEnemies = new Set<Enemy>()
  private gold!: Gold
  /** The run has ended (#17): the game stops and the run-over screen shows. */
  private over = false
  private countdownShown = -1
  private spawnKeys!: { melee: Phaser.Input.Keyboard.Key; ranged: Phaser.Input.Keyboard.Key; tank: Phaser.Input.Keyboard.Key }
  /** Everything that can be hit or auto-aimed at. */
  private get targets(): Target[] {
    return this.hub ? [...this.enemies, this.hub.dummy] : this.enemies
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
    const dest = navStore.get()
    this.mode = dest.mode
    if (dest.mode === 'section') {
      this.world = dest.world
      this.section = dest.section
    }
    this.level = this.mode === 'hub' ? HUB_LEVEL : ARENA_LEVEL
    ARENA.width = this.level.width
    ARENA.height = this.level.height
    this.applyStats(true)

    this.physics.world.gravity.y = GRAVITY
    this.physics.world.setBounds(0, 0, ARENA.width, ARENA.height)

    if (this.mode !== 'hub') this.add.rectangle(0, 0, ARENA.width, ARENA.height, COLOURS.arena).setOrigin(0)
    else this.add.rectangle(0, -400, ARENA.width, ARENA.height + 400, 0x0d0e18).setOrigin(0).setDepth(-3)

    this.createMotes()

    const platforms = this.physics.add.staticGroup()
    for (const p of this.level.platforms) {
      const r = this.add.rectangle(p.x, p.y, p.w, p.h, this.mode === 'hub' && p.solid ? 0x1b1c2a : COLOURS.platform).setOrigin(0)
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

    this.player = this.add.rectangle(this.level.spawn.x, this.level.spawn.y, PLAYER.size, PLAYER.size, 0xffffff).setVisible(false)
    this.view = new PlayerView(this)

    // Desktop dash cooldown: a thin bar under the square, hidden when ready.
    this.cooldownBack = this.add.rectangle(0, 0, PLAYER.size, 6, 0xffffff, 0.12).setOrigin(0, 0.5).setDepth(9)
    this.cooldownBar = this.add.rectangle(0, 0, PLAYER.size, 6, COLOURS.dash, 0.9).setOrigin(0, 0.5).setDepth(9)
    this.reloadBack = this.add.rectangle(0, 0, PLAYER.size, 5, 0xffffff, 0.12).setOrigin(0, 0.5).setDepth(9).setVisible(false)
    this.reloadBar = this.add.rectangle(0, 0, PLAYER.size, 5, 0xfff2b0, 0.95).setOrigin(0, 0.5).setDepth(9).setVisible(false)
    this.physics.add.existing(this.player)

    // Shooting. Bullets pass through platforms; only the floor stops them (#42).
    const floorY = this.mode === 'hub' ? HUB.floor : (this.level.platforms.find((p) => p.solid)?.y ?? ARENA.height)
    this.shooter = new Shooter(this, floorY, () => this.targets)
    this.gold = new Gold(this, floorY, (v) => this.collectGold(v))

    // The run state for this place. Story modes carry gold between sections (#62); endless starts from nothing (#72).
    runStore.reset()
    const prog = progressStore.get()
    if (this.mode === 'hub') {
      runStore.set({ phase: 'hub', mode: 'hub', gold: prog.gold })
      arriveInHub()
      this.hub = new Hub(this, {
        enterWorld: (w) => navStore.go({ mode: 'section', world: w, section: Math.min(4, progressStore.get().cleared[w] + 1) }),
        enterEndless: () => navStore.go({ mode: 'endless' }),
        pulled: (x, y) => {
          this.cine = 'leave'
          this.body_.setVelocity(0, 0).setAllowGravity(false)
          this.view.pullInto(x, y, 0.55)
        },
        buy: (i) => {
          const ok = i === 3 ? shopReroll() : shopBuy(i)
          if (ok) this.applyStats(false)
          return ok
        },
      })
    } else if (this.mode === 'section') {
      runStore.set({ phase: 'intermission', mode: 'section', wave: 1, countdown: 3, gold: prog.gold, world: this.world, section: this.section })
    } else {
      runStore.set({ phase: 'intermission', mode: 'endless', wave: 1, countdown: 3 })
    }
    void loadScores().then((d) => {
      runStore.set({ best: d.best })
      const top = d.runs[0]
      this.hub?.setEndlessBest(d.best, top?.wave ?? 0)
    })
    // Story modes: you have the weapons you've bought, improved as bought (#26, #63).
    if (this.mode !== 'endless') {
      for (const w of prog.weapons) this.shooter.give(w)
      for (const [w, n] of Object.entries(prog.improved)) this.shooter.damageBonus[w as keyof typeof WEAPONS] = 1 + 0.25 * (n ?? 0)
    }

    // Enemies (#40): route-finding graph, a physics group so they bump each other,
    // and platform collisions that let them drop through one-way platforms.
    this.nav = buildNav(this.level.platforms)
    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true })
    this.physics.add.collider(this.enemyGroup, this.enemyGroup)
    this.physics.add.collider(this.enemyGroup, platforms, undefined, (eo, plat) => {
      const e = (eo as Phaser.GameObjects.Arc).getData('enemy') as { dropping: number } | undefined
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
      // Interact (#72): W / ↑ (buy at a pedestal).
      use: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      useAlt: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    }
    // Testing: the on-screen spawn buttons (React) ask for enemies through debugBus.
    const offSpawn = debugBus.onSpawn((kind) => this.spawnEnemy(kind))
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offSpawn)
    this.events.once(Phaser.Scenes.Events.DESTROY, offSpawn)
    // Temporary: E / R / T spawn an extra melee / ranged / tank (desktop), for testing.
    this.spawnKeys = {
      melee: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      ranged: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      tank: kb.addKey(Phaser.Input.Keyboard.KeyCodes.T),
    }
    // Weapon switching (#22, #68): number keys 1–3 and the mouse wheel; blocked while reloading.
    this.weaponKeys = [kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE), kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO), kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE)]
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.shooter.cycle(Math.sign(dy))
    })
    // Testing: "Give weapon" buttons in the settings panel.
    const offGive = debugBus.onGive((id) => {
      this.shooter.give(id)
      this.pushWeaponsHud()
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offGive)
    this.events.once(Phaser.Scenes.Events.DESTROY, offGive)

    // Right-click dashes (#21): towards the mouse in Manual; auto modes decide in readControls.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !p.rightButtonDown()) return
      this.mouseDash = { x: p.worldX - this.player.x, y: p.worldY - this.player.y }
    })
    hudStore.set({ health: this.health, pips: this.pips, stagesPerPip: PLAYER.stagesPerPip })

    const cam = this.cameras.main
    cam.setBounds(0, 0, ARENA.width, ARENA.height)
    cam.startFollow(this.player, false, SCREEN.followLerp, SCREEN.followLerp)
    this.fitCamera()
    cam.centerOn(this.player.x, this.player.y)
    this.scene.launch('markers')
    this.arrive()
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
    if (this.over) return
    if (this.hitStop > 0) {
      this.hitStop -= deltaMs / 1000
      if (this.hitStop <= 0) this.physics.world.resume()
      return
    }
    const c: Controls = this.cine ? { moveX: 0, jump: false, down: false, dash: null } : this.readControls()
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
    if (grounded && !this.dashing && c.moveX !== 0 && Math.sign(c.moveX) !== Math.sign(b.velocity.x) && Math.abs(b.velocity.x) > this.runSpeed * 0.6 && this.skidCooldown === 0) {
      this.skidCooldown = 0.25
      burst(this, this.player.x, feetY - 3, { count: 5, colour: COLOURS.dust, angle: b.velocity.x > 0 ? -0.4 : Math.PI + 0.4, spread: 0.3, speed: [120, 260], size: [5, 9], gravity: -60 })
      sfx.skid()
    }

    // Footstep ticks while running on the ground.
    if (grounded && !this.dashing && Math.abs(b.velocity.x) > this.runSpeed * 0.5) {
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
      this.pushTime = Math.max(0, this.pushTime - dt)
      const target = c.moveX * this.runSpeed
      // While being pushed, steer only gently so the push carries.
      const t = Math.min(1, dt * PLAYER.responsiveness * (this.pushTime > 0 ? 0.15 : 1))
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
          b.setVelocityY(-this.jumpSpeed)
          this.view.kick(0.72, 1.32)
          burst(this, this.player.x, feetY - 3, { count: 6, colour: COLOURS.dust, angle: -DOWN, spread: 1.2, speed: [60, 160], size: [5, 9], gravity: 200 })
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft--
          sfx.airJump()
          b.setVelocityY(-this.jumpSpeed * PLAYER.airJumpScale)
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

    // Reload bar under the player (#68), in the gun's colour.
    const ws = this.shooter.status().weapons.find((w) => w.reloading !== null)
    const reloadY = feetY + (showBar ? 18 : 10)
    this.reloadBack.setVisible(!!ws).setPosition(left, reloadY)
    if (ws) this.reloadBar.setFillStyle(WEAPONS[ws.id].colour, 0.95)
    this.reloadBar.setVisible(!!ws).setPosition(left, reloadY).setScale(ws?.reloading ?? 0, 1)

    this.wasGrounded = grounded
    this.prevBottom = this.body_.bottom
    this.lastVelY = b.velocity.y

    this.updateEnemies(dt)
    this.updateShooting(dt)
    this.checkContacts()
    this.updateTargetZoom(dt)
    this.updateLookAhead(dt)
    this.updateDarkness()
    this.updateMotes(dt)
    this.drawBeam()
  }

  /** Start the beam-in after the fade (#75). */
  private arrive() {
    this.beamG = this.add.graphics().setDepth(8).setBlendMode(Phaser.BlendModes.ADD)
    this.view.beamIn(1.0, 1.25, (b, dir) => this.onBeat(b, dir))
  }

  /** Leave by beam: come apart and lift out, then `then` (#75). */
  private beamOut(then: () => void) {
    this.cine = 'leave'
    this.afterLeave = then
    this.body_.setVelocity(0, 0)
    this.view.beamOut(1.25, (b, dir) => this.onBeat(b, dir))
  }

  private onBeat(b: BeamBeat, dir: 1 | -1) {
    const x = this.player.x
    const feet = this.body_.bottom
    if (b === 'start') {
      if (dir === 1) sfx.beamIn()
      else sfx.beamOut()
    } else if (b === 'feet') {
      sfx.step()
      burst(this, x, feet - 3, { count: 4, colour: 0x8fd3ff, angle: -Math.PI / 2, spread: 1.4, speed: [40, 120], size: [3, 6], life: 300 })
    } else if (b === 'land') {
      if (dir === 1) {
        sfx.land(1)
        this.shake(120, 0.006)
        burst(this, x, feet - 3, { count: 10, colour: COLOURS.dust, angle: -Math.PI / 2, spread: 2.6, speed: [80, 220], size: [5, 9], gravity: 200 })
      } else {
        burst(this, x, feet - 3, { count: 6, colour: 0x8fd3ff, angle: -Math.PI / 2, spread: 0.6, speed: [200, 420], size: [3, 7], life: 400 })
      }
    } else if (b === 'hands' || b === 'eyes') {
      sfx.assemble()
    } else if (b === 'done') {
      if (dir === 1) {
        this.cine = null
        ring(this, x, feet, 140, 26, 0x8fd3ff, { grow: 2.6, life: 420, line: 4 })
        sfx.dashReady()
      } else {
        const then = this.afterLeave
        this.afterLeave = null
        then?.()
      }
    }
  }

  /**
   * The beam (#75): a thin line drops from the top of the view onto the spot,
   * widens into a column while you assemble in it, then collapses. Leaving plays
   * the same thing backwards.
   */
  private drawBeam() {
    const g = this.beamG
    if (!g) return
    g.clear()
    const k = this.view.beamK
    if (k === null) return
    const x = this.player.x
    const feet = this.body_.bottom
    const top = this.cameras.main.worldView.top - 60
    const head = top + (feet - top) * Math.min(1, k / 0.2)
    let w = 4
    if (k > 0.2) w = 4 + 66 * Math.min(1, (k - 0.2) / 0.15)
    if (k > 0.85) w = 70 * (1 - (k - 0.85) / 0.15)
    w *= 1 + Math.sin(this.time.now / 25) * 0.05
    if (w <= 0.5) return
    g.fillStyle(0x8fd3ff, 0.18)
    g.fillRect(x - w, top, w * 2, head - top)
    g.fillStyle(0xcfeaff, 0.35)
    g.fillRect(x - w / 2, top, w, head - top)
    g.fillStyle(0xffffff, 0.8)
    g.fillRect(x - Math.max(1.5, w / 8), top, Math.max(3, w / 4), head - top)
    // Where it meets the floor: a bright pool.
    if (k > 0.15) {
      g.fillStyle(0xcfeaff, 0.35)
      g.fillEllipse(x, feet, w * 2.6, 14)
    }
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

    for (let i = 0; i < this.weaponKeys.length; i++) if (Phaser.Input.Keyboard.JustDown(this.weaponKeys[i])) this.shooter.select(i)
    if (touchInput.switchQueued) {
      this.shooter.cycle(1)
      touchInput.switchQueued = false
    }

    const shot = this.shooter.update(dt, {
      x: this.player.x,
      y: this.player.y,
      facing: this.facing,
      dashing: this.dashing || this.cine !== null,
      mode,
      fireHeld: fireHeld && !this.cine,
      aimPoint,
      pxToWorld: 1 / cam.zoom,
      crosshair: desktopManual && aimPoint ? aimPoint : null,
    })
    if (shot) {
      // Recoil: mostly sideways; lift if firing downwards in the air. The shotgun shoves hard.
      const b = this.body_
      b.setVelocityX(b.velocity.x - shot.x * shot.recoil)
      if (!b.blocked.down) b.setVelocityY(b.velocity.y - shot.y * shot.recoil * 0.5)
      const k = shot.recoil > 200 ? 0.18 : 0.06
      this.view.kick(1 - Math.abs(shot.x) * k, 1 - Math.abs(shot.y) * k)
      if (shot.recoil > 200) {
        this.shake(90, 0.006)
        this.pushTime = 0.18
      }
    }
    this.view.holdGun(this.shooter.grip)
    touchInput.weaponCount = this.shooter.status().weapons.length
    // Keep the HUD's weapon icons current (ammo, reload) without flooding React.
    this.hudWeaponsTimer -= dt
    if (shot || this.shooter.reloading || this.hudWeaponsTimer <= 0) this.pushWeaponsHud()
  }

  private updateEnemies(dt: number) {
    const b = this.body_
    const grounded = b.blocked.down || b.touching.down
    const plat = grounded ? platformAt(this.nav, this.player.x, b.bottom) : -1
    const pi = this.playerInfo
    pi.x = this.player.x
    pi.y = this.player.y
    pi.vx = b.velocity.x
    pi.vy = b.velocity.y
    pi.platform = plat >= 0 ? plat : platformBelow(this.nav, this.player.x, b.bottom)
    pi.view.setTo(this.cameras.main.worldView.x, this.cameras.main.worldView.y, this.cameras.main.worldView.width, this.cameras.main.worldView.height)

    this.turns.tick(dt)
    this.tankTurns.tick(dt)
    for (const e of this.enemies) e.update(dt, pi)
    this.enemies = this.enemies.filter((e) => !e.dead)

    // Hazards (shots, shockwaves) hurt on touch unless you're invulnerable.
    for (const h of this.hazards) {
      h.update(dt)
      if (!h.done && !this.invulnerable && h.hits(b.left, b.top, b.right, b.bottom)) {
        this.takeHit(h.x, h.damage)
        h.done = true
      }
      if (h.done) h.destroy()
    }
    this.hazards = this.hazards.filter((h) => !h.done)

    // Testing: E / R / T spawn an extra melee / ranged / tank (not part of the wave).
    for (const kind of ['melee', 'ranged', 'tank'] as const) {
      if (Phaser.Input.Keyboard.JustDown(this.spawnKeys[kind])) this.spawnEnemy(kind)
    }

    this.updateWaves(dt)
    if (this.hub) {
      const use = !this.cine && (Phaser.Input.Keyboard.JustDown(this.keys.use) || Phaser.Input.Keyboard.JustDown(this.keys.useAlt) || touchInput.useQueued)
      touchInput.useQueued = false
      this.hub.update(dt, { ...this.playerInfo, bottom: this.body_.bottom }, use)
      touchInput.useAvailable = this.hub.canUse && !this.cine
      touchInput.useLabel = this.hub.useLabel
    }
    this.gold.update(dt, this.player.x, this.player.y)
  }

  /** Walkers on a random platform, fliers in the air; preferably well away from the player. */
  /**
   * The wave director (#13, #18): during a wave, spawn from the queue while
   * below the on-screen cap; when the queue's empty and the wave's enemies are
   * all dead, the wave's cleared. Between waves, a countdown to the next.
   */
  private updateWaves(dt: number) {
    if (this.mode === 'hub' || this.cine === 'arrive') return
    const run = runStore.get()
    if (run.phase === 'fighting') {
      const alive = [...this.waveEnemies].filter((e) => !e.dead).length
      this.waveSpawnTimer -= dt
      if (this.waveQueue.length && alive < maxAlive(this.effectiveWave(run.wave)) && this.waveSpawnTimer <= 0) {
        const e = this.spawnEnemy(this.waveQueue.shift()!)
        this.waveEnemies.add(e)
        this.waveSpawnTimer = WAVES.spawnGap
      }
      for (const e of this.waveEnemies) if (e.dead) this.waveEnemies.delete(e)
      const left = this.waveQueue.length + this.waveEnemies.size
      if (left !== run.left) runStore.set({ left })
      if (left === 0) this.clearWave()
    } else if (run.phase === 'intermission') {
      const countdown = Math.max(0, run.countdown - dt)
      // Only tell React when the whole second changes.
      if (Math.ceil(countdown) !== this.countdownShown) {
        this.countdownShown = Math.ceil(countdown)
        runStore.set({ countdown })
      } else {
        runStore.get().countdown = countdown
      }
      if (countdown <= 0) this.startWave(run.wave)
    }
  }

  /**
   * Story sections are 5 waves (#62); later sections start further up the
   * wave curve (Claude: section n plays waves 2n-1 … 2n+3). Endless is as is.
   */
  private effectiveWave(n: number) {
    return this.mode === 'section' ? n + (this.section - 1) * 2 : n
  }

  private startWave(n: number) {
    this.waveQueue = waveOrder(this.effectiveWave(n))
    this.waveSpawnTimer = 0
    this.waveEnemies.clear()
    const run = runStore.get()
    runStore.set({ phase: 'fighting', wave: n, left: waveSize(this.effectiveWave(n)), waveGold: 0, waveStarts: run.waveStarts + 1 })
    sfx.waveStart()
  }

  private clearWave() {
    const run = runStore.get()
    this.gold.collectAll()
    sfx.waveClear()
    if (this.mode === 'section' && run.wave >= 5) {
      this.clearSection()
      return
    }
    this.countdownShown = -1
    runStore.set({ phase: 'intermission', wave: run.wave + 1, countdown: WAVES.intermission, left: 0 })
  }

  private collectGold(v: number) {
    const run = runStore.get()
    // Score is everything earned this run; spending (later, in the shop) never lowers it (#53).
    runStore.set({ gold: run.gold + v, score: run.score + v, waveGold: run.waveGold + v })
  }

  /** A kill: gold drops (#53) worth more in later waves, and you heal a stage (#48). */
  private onEnemyKilled(kind: EnemyKind, x: number, y: number, source: HitSource) {
    const run = runStore.get()
    this.gold.drop(x, y, goldFor(kind, Math.max(1, this.effectiveWave(run.wave))))
    runStore.set({ kills: run.kills + 1 })
    // Only dash and stomp kills heal (#69): the risky play keeps you alive; guns don't.
    if (source !== 'shot') this.onKill()
  }

  /** Health hit zero: the run is over (#17). Everything resets; the score is recorded. */
  /** Section cleared (no bosses yet, so after wave 5): keep gold and damage, mark progress, back to the hub (#62, #70). */
  private clearSection() {
    runStore.set({ phase: 'cleared', left: 0 })
    // Let the last gold arrive, then beam out (#75), bank it and go home.
    this.time.delayedCall(1500, () => this.beamOut(() => {
      const run = runStore.get()
      const prog = progressStore.get()
      progressStore.set({
        gold: run.gold,
        health: this.health,
        cleared: { ...prog.cleared, [this.world]: Math.max(prog.cleared[this.world], this.section) },
      })
      navStore.go({ mode: 'hub' })
    }))
  }

  /** Re-read upgrades and weapons after a purchase (#63) and apply them now. */
  private applyStats(initial: boolean) {
    if (this.mode === 'endless') {
      this.runSpeed = PLAYER.runSpeed
      this.jumpSpeed = PLAYER.jumpSpeed
      this.pips = PLAYER.pips
      this.impactBonus = 1
      if (initial) this.health = this.pips * PLAYER.stagesPerPip
      return
    }
    const prog = progressStore.get()
    const st = storyStats(prog)
    this.runSpeed = PLAYER.runSpeed * st.runMul
    this.jumpSpeed = PLAYER.jumpSpeed * st.jumpMul
    this.pips = st.pips
    this.impactBonus = st.impact
    this.health = Math.min(this.pips * PLAYER.stagesPerPip, prog.health ?? this.pips * PLAYER.stagesPerPip)
    if (!initial) {
      for (const w of prog.weapons) if (!this.shooter.status().weapons.some((x) => x.id === w)) this.shooter.give(w)
      for (const [w, n] of Object.entries(prog.improved)) this.shooter.damageBonus[w as keyof typeof WEAPONS] = 1 + 0.25 * (n ?? 0)
      this.pushWeaponsHud()
      hudStore.set({ health: this.health, pips: this.pips })
      runStore.set({ gold: prog.gold })
    }
  }

  private endRun() {
    if (this.mode === 'section') {
      // Story death (#62): lose all carried gold, no way back; back to the hub fully healed (#70).
      this.over = true
      this.physics.world.pause()
      this.view.flicker = false
      this.shake(400, 0.02)
      sfx.runOver()
      buzz(250)
      burst(this, this.player.x, this.player.y, { count: 24, colour: 0xffffff, angle: 0, spread: Math.PI, speed: [150, 450], size: [5, 11], life: 700 })
      runStore.set({ phase: 'dead', lostGold: runStore.get().gold, gold: 0 })
      progressStore.set({ gold: 0, health: null })
      window.setTimeout(() => navStore.go({ mode: 'hub' }), 2800)
      return
    }
    this.over = true
    this.physics.world.pause()
    this.view.flicker = false
    this.shake(400, 0.02)
    sfx.runOver()
    buzz(250)
    burst(this, this.player.x, this.player.y, { count: 24, colour: 0xffffff, angle: 0, spread: Math.PI, speed: [150, 450], size: [5, 11], life: 700 })
    const run = runStore.get()
    const score = run.score
    runStore.set({ phase: 'over', newBest: score > run.best })
    void recordRun({ score, wave: run.wave, kills: run.kills, at: Date.now() }).then((best) => runStore.set({ best }))
  }

  /** Spawn one enemy: walkers on a random platform, fliers in the air; preferably well away from the player. */
  private spawnEnemy(kind: EnemyKind): Enemy {
    const plats = this.level.platforms
    const far = plats.filter((p) => Math.abs(p.x + p.w / 2 - this.player.x) + Math.abs(p.y - this.player.y) > 600)
    const pool = far.length ? far : [...plats]
    const p = pool[Phaser.Math.Between(0, pool.length - 1)]
    let me: Enemy | null = null
    const kill = () => {
      if (me) this.onEnemyKilled(kind, me.x, me.y, me.lastHitSource)
    }
    if (kind === 'ranged') {
      const x = Phaser.Math.Between(100, ARENA.width - 100)
      const y = Phaser.Math.Between(250, ARENA.height - 400)
      me = new RangedEnemy(this, x, y, this.turns, kill, (h) => this.hazards.push(h))
      this.enemies.push(me)
      return me
    }
    if (kind === 'tank') {
      const x = Phaser.Math.Between(p.x + 60, p.x + p.w - 60)
      const e = new TankEnemy(this, x, p.y - TANK.size * 0.43 - 2, this.nav, this.tankTurns, kill, (h) => this.hazards.push(h), (ms, k) => this.shake(ms, k))
      this.enemyGroup.add(e.o)
      const tb = e.o.body as Phaser.Physics.Arcade.Body
      tb.setCollideWorldBounds(true)
      tb.pushable = false
      tb.enable = false
      this.enemies.push(e)
      me = e
      return e
    }
    const x = Phaser.Math.Between(p.x + 40, p.x + p.w - 40)
    const e = new MeleeEnemy(this, x, p.y - MELEE.radius - 2, this.nav, kill, this.turns)
    this.enemyGroup.add(e.o)
    ;(e.o.body as Phaser.Physics.Arcade.Body).setCircle(MELEE.radius).setCollideWorldBounds(true)
    ;(e.o.body as Phaser.Physics.Arcade.Body).enable = false
    this.enemies.push(e)
    me = e
    return e
  }

  /**
   * Player vs targets. Dashing through one hits it (once per dash, #24).
   * Touching one does nothing (#52); only an enemy that's attacking hurts you.
   */
  private checkContacts() {
    const b = this.body_
    for (const t of this.targets) {
      if (!t.alive) continue
      const nx = Phaser.Math.Clamp(t.x, b.left, b.right)
      const ny = Phaser.Math.Clamp(t.y, b.top, b.bottom)
      if (Phaser.Math.Distance.Between(nx, ny, t.x, t.y) > t.radius) continue
      const e = t as Enemy
      if (this.dashing) {
        if (this.dashHits.has(t) || !e.hittable) continue
        this.dashHits.add(t)
        t.hit(DASH.damage * this.impactBonus, { x: this.dashDir.x, y: this.dashDir.y }, 'dash')
        if ((t as Enemy).heavy) {
          // Too heavy to move (#58): you bounce off it.
          this.endDash(0)
          this.body_.setVelocity(-this.dashDir.x * TANK.dashBounce, -Math.abs(this.dashDir.y) * TANK.dashBounce * 0.5 - 200)
          this.pushTime = 0.25
          this.view.kick(0.65, 1.3)
        }
        sfx.dashHit()
        buzz(25)
        this.shake(80, 0.004)
        burst(this, t.x, t.y, { count: 8, colour: 0xffffff, angle: this.dashDir.angle(), spread: 0.8, speed: [150, 380], size: [4, 8], life: 220 })
        this.freeze(PLAYER.dashHitStop)
      } else if (t.attacking) {
        // An attacking enemy always wins, even from above (#59).
        if (!this.invulnerable) {
          this.takeHit(t.x, e.damage)
          return
        }
      } else if (e.hittable && b.velocity.y > 0 && this.prevBottom <= e.top + (t.y - e.top) * 2 * STOMP.fromAbove) {
        this.stompOn(e)
        return
      }
    }
  }

  /** A kill counts towards healing one pip, unless you're already at full health (#47). */
  /** Each kill restores one stage (#48); wasted at full health. A pip refilling gets the bigger effect. */
  private onKill() {
    const max = this.pips * PLAYER.stagesPerPip
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
    this.view.grin()
    ring(this, x, y, PLAYER.size * 1.3, PLAYER.size * 1.3, 0xffffff, { grow: 2.4, life: 420, alpha: 0.8 })
    burst(this, x, y + PLAYER.size * 0.3, { count: 10, colour: 0xffffff, angle: -DOWN, spread: 0.7, speed: [80, 200], size: [4, 7], life: 520, gravity: -150 })
    sfx.heal()
    buzz(20)
  }

  /** Landed on an enemy from above (#59): it's hit and flattened, you bounce up with your double jump back. */
  private stompOn(e: Enemy) {
    const b = this.body_
    e.stomp(this.player.x, STOMP.damage * this.impactBonus)
    if (e.heavy) {
      // The tank doesn't budge: you're knocked away instead.
      const away = Math.sign(this.player.x - e.x) || this.facing
      b.setVelocity(away * STOMP.tankKnock.x, -STOMP.tankKnock.y)
      this.pushTime = 0.25
    } else {
      b.setVelocityY(-STOMP.bounce)
    }
    this.airJumpsLeft = PLAYER.airJumps
    this.view.kick(1.35, 0.7)
    this.view.grin()
    const feet = b.bottom
    ring(this, this.player.x, feet, PLAYER.size * 1.6, PLAYER.size * 0.5, 0xffffff, { grow: 2, life: 240, alpha: 0.8 })
    burst(this, this.player.x, feet, { count: 8, colour: e.colour, angle: DOWN, spread: 1.2, speed: [120, 300], size: [4, 8], life: 260 })
    sfx.stomp()
    buzz(30)
    this.shake(90, 0.005)
    this.freeze(PLAYER.dashHitStop)
  }

  private freeze(seconds: number) {
    this.hitStop = Math.max(this.hitStop, seconds)
    this.physics.world.pause()
  }

  /** Knockback, lose a hit point, short invulnerability (#23, #27). */
  /** Getting hurt: only attacks hurt (#52): lunges, shots, slams, shockwaves (stages per #57, #58). */
  private takeHit(fromX: number, damage: number) {
    if (this.cine) return
    this.health -= damage
    this.hurtTime = PLAYER.hurtInvulnerability
    const away = Math.sign(this.player.x - fromX) || -this.facing
    const hud = hudStore.get()
    this.body_.setVelocity(away * PLAYER.hurtKnockback.x, -PLAYER.hurtKnockback.y)
    this.pushTime = 0.3
    this.view.kick(1.35, 0.7)
    this.view.pulse(0.12)
    this.view.ouch()
    burst(this, this.player.x, this.player.y, { count: 12, colour: 0xff5a5a, angle: 0, spread: Math.PI, speed: [150, 380], size: [4, 9], life: 320 })
    this.shake(170, 0.012)
    sfx.hurt()
    buzz(80)
    this.freeze(PLAYER.hurtHitStop)
    this.health = Math.max(0, this.health)
    hudStore.set({ health: this.health, hurtCount: hud.hurtCount + 1 })
    if (this.health <= 0) this.endRun()
  }



  private pushWeaponsHud() {
    this.hudWeaponsTimer = 0.25
    const st = this.shooter.status()
    hudStore.set({ weapons: st.weapons, currentWeapon: st.current })
  }

  /** For the marker overlay. */
  get markerInfo() {
    return { targets: this.enemies as Target[], target: this.shooter.target, player: this.player }
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
    const v = this.body_.velocity.x / this.runSpeed
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
      const v = this.view
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

/** One-attacker-at-a-time token (#49), with a short gap between turns. */
function makeTurns(gapSeconds: number): Turns & { tick(dt: number): void } {
  let holder: object | null = null
  let gap = 0
  return {
    request(e) {
      if (holder && holder !== e) return false
      if (holder !== e && gap > 0) return false
      holder = e
      return true
    },
    release(e) {
      if (holder !== e) return
      holder = null
      gap = gapSeconds
    },
    isOthers(e) {
      return !!holder && holder !== e
    },
    tick(dt) {
      gap = Math.max(0, gap - dt)
      if (holder && (holder as Enemy).dead) holder = null
    },
  }
}
