// Celestial Gothic Horror's hand-built arenas (#100, #102), from the mockups on
// the world canvas. Coordinates are world px, same as the drawings.
// Candles and eyes are decoration for now: their mechanics (light that can be
// taken, eyes that watch, #93) aren't built yet.
import type { Level, LevelDecor } from '../levels.ts'

const STYLE: Level['style'] = {
  bg: 0x140e24,
  plat: 0x4a3e6a,
  block: 0x332a4c,
  edge: 0x16112a,
  top: 0x7a6ea0,
}
const GOLD = 0xc8913a
const STONE = 0x5a4e7e
const TIMBER = 0x6a4a36

const candles = (...xy: [number, number][]): LevelDecor[] => xy.map(([x, y]) => ({ t: 'candle' as const, x, y }))
const eyes = (...xy: [number, number][]): LevelDecor[] => xy.map(([x, y]) => ({ t: 'eye' as const, x, y }))

/** 1 · The Nave: gentle. Lofts, pillars, altar, pulpits, a swinging chandelier, one crumbling ledge. */
const NAVE: Level = {
  width: 2400,
  height: 1350,
  floorY: 1270,
  style: STYLE,
  spawn: { x: 760, y: 1230 },
  platforms: [
    { x: 0, y: 1270, w: 2400, h: 80, solid: true, floor: true },
    { x: 0, y: 0, w: 60, h: 1270, solid: true, edge: true },
    { x: 2340, y: 0, w: 60, h: 1270, solid: true, edge: true },
    { x: 60, y: 0, w: 2280, h: 40, solid: true, edge: true },
    // Pillars and their capitals.
    { x: 470, y: 360, w: 80, h: 910, solid: true },
    { x: 440, y: 330, w: 140, h: 30, solid: true },
    { x: 1850, y: 360, w: 80, h: 910, solid: true },
    { x: 1820, y: 330, w: 140, h: 30, solid: true },
    // Choir lofts.
    { x: 60, y: 760, w: 370, h: 36, solid: true },
    { x: 1970, y: 680, w: 370, h: 36, solid: true },
    // Altar dais.
    { x: 980, y: 1214, w: 440, h: 56, solid: true },
    { x: 1060, y: 1164, w: 280, h: 50, solid: true },
    { x: 1130, y: 1110, w: 140, h: 54, solid: true },
    // Pulpits (one-way).
    { x: 680, y: 960, w: 200, h: 22 },
    { x: 1520, y: 960, w: 200, h: 22 },
    // Broken arches: the right one crumbles.
    { x: 720, y: 556, w: 200, h: 22 },
    { x: 1480, y: 556, w: 200, h: 22, crumble: true },
  ],
  env: [{ t: 'mover', x: 990, y: 760, w: 180, h: 20, dx: 240, colour: GOLD }],
  decor: [
    ...candles([1155, 1110], [1200, 1110], [1245, 1110], [272, 1270], [300, 1270], [328, 1270], [2072, 1270], [2100, 1270], [2128, 1270], [200, 760], [2200, 680], [780, 960], [1620, 960]),
    ...eyes([190, 520], [2290, 430]),
  ],
}

/** 2 · The Crypt: pits arrive. Niches, sarcophagi, coffin lids (two rotten), a gibbet cage. */
const CRYPT: Level = {
  width: 2400,
  height: 1200,
  floorY: 1120,
  style: STYLE,
  spawn: { x: 560, y: 1080 },
  pits: [
    { x: 700, w: 200 },
    { x: 1500, w: 160 },
  ],
  platforms: [
    { x: 0, y: 1120, w: 700, h: 80, solid: true, floor: true },
    { x: 900, y: 1120, w: 600, h: 80, solid: true, floor: true },
    { x: 1660, y: 1120, w: 740, h: 80, solid: true, floor: true },
    { x: 0, y: 0, w: 60, h: 1120, solid: true, edge: true },
    { x: 2340, y: 0, w: 60, h: 1120, solid: true, edge: true },
    { x: 60, y: 0, w: 2280, h: 220, solid: true, edge: true },
    // Sarcophagi.
    { x: 300, y: 1040, w: 180, h: 80, solid: true },
    { x: 1100, y: 1040, w: 200, h: 80, solid: true },
    { x: 1950, y: 1040, w: 180, h: 80, solid: true },
    // Burial niches.
    { x: 60, y: 860, w: 210, h: 30, solid: true },
    { x: 60, y: 600, w: 210, h: 30, solid: true },
    { x: 2130, y: 820, w: 210, h: 30, solid: true },
    { x: 2130, y: 560, w: 210, h: 30, solid: true },
    // Coffin lids; two rotten.
    { x: 640, y: 880, w: 180, h: 22 },
    { x: 1380, y: 880, w: 180, h: 22 },
    { x: 980, y: 760, w: 180, h: 22, crumble: true },
    { x: 1700, y: 680, w: 180, h: 22, crumble: true },
  ],
  env: [{ t: 'mover', x: 1196, y: 560, w: 128, h: 20, dy: 300, colour: STONE }],
  decor: [...candles([390, 1040], [1185, 1040], [1215, 1040], [2040, 1040], [165, 860], [2235, 560], [1470, 880]), ...eyes([165, 440], [2235, 400], [960, 260])],
}

/** 3 · The Bell Tower: tall; wind arrives. Zigzag landings, a counterweight, a swinging bell. */
const TOWER: Level = {
  width: 1600,
  height: 2400,
  floorY: 2320,
  style: STYLE,
  spawn: { x: 520, y: 2280 },
  platforms: [
    { x: 0, y: 2320, w: 1600, h: 80, solid: true, floor: true },
    // Side walls, open at the belfry.
    { x: 0, y: 700, w: 60, h: 1620, solid: true, edge: true },
    { x: 1540, y: 700, w: 60, h: 1620, solid: true, edge: true },
    { x: 0, y: 0, w: 60, h: 290, solid: true, edge: true },
    { x: 1540, y: 0, w: 60, h: 290, solid: true, edge: true },
    { x: 60, y: 0, w: 1480, h: 60, solid: true, edge: true },
    // Belfry beam.
    { x: 60, y: 250, w: 1480, h: 30, solid: true },
    // Landings (one-way, timber); half of the third one is rotten.
    { x: 60, y: 2060, w: 640, h: 26 },
    { x: 900, y: 1800, w: 640, h: 26 },
    { x: 60, y: 1540, w: 380, h: 26 },
    { x: 440, y: 1540, w: 260, h: 26, crumble: true },
    { x: 900, y: 1280, w: 640, h: 26 },
    { x: 60, y: 1020, w: 640, h: 26 },
    { x: 900, y: 760, w: 640, h: 26 },
    { x: 60, y: 520, w: 640, h: 26 },
    // The fallen bell on the floor.
    { x: 1180, y: 2240, w: 180, h: 80, solid: true },
  ],
  env: [
    { t: 'mover', x: 736, y: 1320, w: 128, h: 22, dy: 580, colour: STONE },
    { t: 'mover', x: 650, y: 360, w: 120, h: 20, dx: 180, colour: GOLD },
    { t: 'wind', x: 60, y: 300, w: 1480, h: 400, dir: 'left' },
  ],
  decor: [...candles([380, 2060], [1220, 1800], [250, 1540], [1220, 1280], [380, 1020], [785, 2320], [813, 2320]), ...eyes([100, 1680], [1500, 1160], [100, 880])],
  platformColour: TIMBER,
}

/** 4 · The Breach: everything. Islands over the void, drifting and crumbling stone, an updraught. */
const BREACH: Level = {
  width: 2800,
  height: 1400,
  floorY: 1300,
  style: { ...STYLE, bg: 0x1a1236 },
  spawn: { x: 260, y: 1260 },
  pits: [
    { x: 520, w: 380 },
    { x: 1300, w: 400 },
    { x: 2100, w: 320 },
  ],
  platforms: [
    { x: 0, y: 1300, w: 520, h: 100, solid: true, floor: true },
    { x: 900, y: 1300, w: 400, h: 100, solid: true, floor: true },
    { x: 1700, y: 1300, w: 400, h: 100, solid: true, floor: true },
    { x: 2420, y: 1300, w: 380, h: 100, solid: true, floor: true },
    { x: 0, y: 0, w: 60, h: 1300, solid: true, edge: true },
    { x: 2740, y: 0, w: 60, h: 1300, solid: true, edge: true },
    // Ruined ledges and the central slab.
    { x: 260, y: 860, w: 300, h: 40, solid: true },
    { x: 2200, y: 860, w: 300, h: 40, solid: true },
    { x: 1200, y: 800, w: 400, h: 24 },
    // Crumbling stone.
    { x: 1400, y: 1100, w: 200, h: 24, crumble: true },
    { x: 760, y: 560, w: 200, h: 24, crumble: true },
    { x: 1840, y: 560, w: 200, h: 24, crumble: true },
  ],
  env: [
    { t: 'mover', x: 560, y: 1110, w: 200, h: 24, dx: 120, colour: STONE },
    { t: 'mover', x: 2160, y: 840, w: 200, h: 24, dy: 260, colour: STONE },
    { t: 'wind', x: 1320, y: 420, w: 360, h: 880, dir: 'up' },
  ],
  decor: [...candles([410, 860], [1345, 800], [1455, 800], [2350, 860], [1100, 1300]), ...eyes([640, 340], [2050, 300], [160, 560])],
}

/** The major boss arena: mostly empty. Long floor, climbable pillars, four platforms at the edges. */
const SANCTUM: Level = {
  width: 3000,
  height: 1400,
  floorY: 1300,
  style: { ...STYLE, bg: 0x1c1338 },
  spawn: { x: 320, y: 1260 },
  platforms: [
    { x: 0, y: 1300, w: 3000, h: 100, solid: true, floor: true },
    { x: 0, y: 0, w: 120, h: 1300, solid: true, edge: true },
    { x: 2880, y: 0, w: 120, h: 1300, solid: true, edge: true },
    // Broken pillars.
    { x: 120, y: 440, w: 80, h: 860, solid: true },
    { x: 2800, y: 480, w: 80, h: 820, solid: true },
    { x: 300, y: 1020, w: 220, h: 24 },
    { x: 2480, y: 1020, w: 220, h: 24 },
    { x: 620, y: 760, w: 180, h: 24 },
    { x: 2200, y: 760, w: 180, h: 24 },
  ],
  decor: candles([500, 1300], [900, 1300], [1300, 1300], [1700, 1300], [2100, 1300], [2500, 1300], [410, 1020], [2590, 1020]),
}

export const CELESTIAL_ROOMS: { id: string; name: string; level: Level }[] = [
  { id: 'nave', name: '1 · The Nave', level: NAVE },
  { id: 'crypt', name: '2 · The Crypt', level: CRYPT },
  { id: 'tower', name: '3 · The Bell Tower', level: TOWER },
  { id: 'breach', name: '4 · The Breach', level: BREACH },
  { id: 'sanctum', name: 'Boss · The Sanctum', level: SANCTUM },
]
