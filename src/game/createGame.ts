import Phaser from 'phaser'
import { navStore } from '../state/nav.ts'
import { GameScene } from './GameScene.ts'
import { MarkersScene } from './MarkersScene.ts'
import { TouchControlsScene } from './TouchControlsScene.ts'

// Renders at the screen's real pixel density: the canvas is CSS size × dpr,
// shown at 1/dpr zoom, so shapes stay sharp on high-DPI phones.
const dpr = () => Math.min(window.devicePixelRatio || 1, 3)

export function createGame(parent: HTMLElement): { game: Phaser.Game; destroy: () => void } {
  const ratio = dpr()
  const size = () => ({
    w: Math.max(1, Math.round(parent.clientWidth * ratio)),
    h: Math.max(1, Math.round(parent.clientHeight * ratio)),
  })
  const { w, h } = size()

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#07070a',
    scale: { mode: Phaser.Scale.NONE, width: w, height: h, zoom: 1 / ratio },
    // fixedStep off: physics steps once per drawn frame, so movement is smooth on
    // 90/120 Hz screens instead of updating every other frame (#31).
    physics: { default: 'arcade', arcade: { debug: false, fixedStep: false } },
    input: { activePointers: 4 },
    disableContextMenu: true,
    callbacks: { preBoot: (g) => g.registry.set('dpr', ratio) },
    scene: [GameScene, MarkersScene, TouchControlsScene],
  })

  // Handy for poking at the game from the console / automated checks in dev.
  if (import.meta.env.DEV) Object.assign(window, { __game: game, __nav: navStore })

  const observer = new ResizeObserver(() => {
    const s = size()
    if (s.w !== game.scale.width || s.h !== game.scale.height) game.scale.resize(s.w, s.h)
  })
  observer.observe(parent)

  return {
    game,
    destroy: () => {
      observer.disconnect()
      game.destroy(true)
    },
  }
}
