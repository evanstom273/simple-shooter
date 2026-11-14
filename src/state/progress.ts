// Story progress (#62, #63, #70): what's kept between sections and saved on the
// device. Plain TS (no Phaser) so React and the game can both use it.
import { db } from '../persist/db.ts'

export type UpgradeId = 'health' | 'jump' | 'speed' | 'impact'
export type WeaponId = 'pistol' | 'automatic' | 'shotgun'
export type OfferId = UpgradeId | WeaponId | `improve-${WeaponId}` | 'heal'

export interface Offer {
  id: OfferId
  price: number
  sold: boolean
}

export interface Progress {
  /** Sections cleared per world (0–4); the next section is cleared + 1 (#62 checkpoints). */
  cleared: Record<1 | 2 | 3 | 4, number>
  /** Upgrades bought (#63: Health, Jump Height, Movement Speed, Dash & stomp damage, #69). */
  upgrades: Record<UpgradeId, number>
  /** Weapons owned and how many times each has been improved (#26). */
  weapons: WeaponId[]
  improved: Partial<Record<WeaponId, number>>
  /** Gold carried: lost on death with no way back (#62). */
  gold: number
  /** Health in stages; null = full. Kept after clearing a section, refilled after dying (#70). */
  health: number | null
  /** How many times each offer has been bought (prices escalate, #54). */
  bought: Partial<Record<string, number>>
  /** The shop's current offers and reroll fee; restocked on every arrival in the hub (#70). */
  stock: Offer[]
  rerollPrice: number
  /** Increments every time you arrive in the hub, so the shop restocks once per visit. */
  visit: number
  stockVisit: number
}

export const STORY = {
  basePips: 5,
  stagesPerPip: 4,
  /** Diminishing returns (#19): the nth purchase adds step × 0.8^(n-1). */
  jumpStep: 0.12,
  speedStep: 0.1,
  impactStep: 0.25,
  rerollStart: 150,
  rerollGrowth: 1.6,
  /** Prices go up by this factor for each repeat purchase (#54). */
  priceGrowth: 1.5,
} as const

export const OFFER_INFO: Record<string, { label: string; note: string; base: number; colour: string }> = {
  health: { label: 'Health', note: '+1 pip', base: 600, colour: '#ff6b6b' },
  jump: { label: 'Jump Height', note: 'jump higher', base: 450, colour: '#7fd1ff' },
  speed: { label: 'Movement Speed', note: 'run faster', base: 450, colour: '#8ff59a' },
  impact: { label: 'Dash & stomp', note: 'more damage', base: 600, colour: '#8fd3ff' },
  pistol: { label: 'Pistol', note: 'new weapon', base: 1200, colour: '#fff2b0' },
  automatic: { label: 'Automatic', note: 'new weapon', base: 1800, colour: '#ffd27a' },
  shotgun: { label: 'Shotgun', note: 'new weapon', base: 1600, colour: '#ffb38a' },
  'improve-pistol': { label: 'Pistol+', note: '+25% damage', base: 900, colour: '#fff2b0' },
  'improve-automatic': { label: 'Automatic+', note: '+25% damage', base: 900, colour: '#ffd27a' },
  'improve-shotgun': { label: 'Shotgun+', note: '+25% damage', base: 900, colour: '#ffb38a' },
  heal: { label: 'Heal', note: '+2 pips', base: 300, colour: '#ffffff' },
}

const fresh = (): Progress => ({
  cleared: { 1: 0, 2: 0, 3: 0, 4: 0 },
  upgrades: { health: 0, jump: 0, speed: 0, impact: 0 },
  weapons: [],
  improved: {},
  gold: 0,
  health: null,
  bought: {},
  stock: [],
  rerollPrice: STORY.rerollStart,
  visit: 0,
  stockVisit: -1,
})

let state: Progress = fresh()
const listeners = new Set<() => void>()
const ID = 'progress'

export const progressStore = {
  get: () => state,
  set(patch: Partial<Progress>) {
    state = { ...state, ...patch }
    listeners.forEach((l) => l())
    void save()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

export async function loadProgress() {
  try {
    const rec = await db.saves.get(ID)
    const d = rec?.data as Partial<Progress> | undefined
    if (d) state = { ...fresh(), ...d, cleared: { ...fresh().cleared, ...d.cleared }, upgrades: { ...fresh().upgrades, ...d.upgrades } }
  } catch {
    // No saved progress (or storage blocked): start fresh.
  }
  listeners.forEach((l) => l())
}

async function save() {
  try {
    await db.saves.put({ id: ID, data: state, updatedAt: Date.now() })
  } catch {
    // Private mode etc.: progress just won't persist.
  }
}

// ---- Derived stats ---------------------------------------------------------

const dim = (n: number, step: number) => (step * (1 - Math.pow(0.8, n))) / 0.2

export function maxPips(p = state) {
  return STORY.basePips + p.upgrades.health
}

export function storyStats(p = state) {
  return {
    pips: maxPips(p),
    runMul: 1 + dim(p.upgrades.speed, STORY.speedStep),
    /** Jump height scales with speed²: a +x% height is √(1+x) speed. */
    jumpMul: Math.sqrt(1 + dim(p.upgrades.jump, STORY.jumpStep)),
    impact: 1 + dim(p.upgrades.impact, STORY.impactStep),
  }
}

export function priceOf(id: OfferId, p = state) {
  const n = p.bought[id] ?? 0
  return Math.round((OFFER_INFO[id].base * Math.pow(STORY.priceGrowth, n)) / 10) * 10
}

/** A fresh random 3 from what's sensible right now (#63). */
export function rollStock(p = state): Offer[] {
  const pool: OfferId[] = ['health', 'jump', 'speed', 'impact']
  for (const w of ['pistol', 'automatic', 'shotgun'] as WeaponId[]) pool.push(p.weapons.includes(w) ? (`improve-${w}` as OfferId) : w)
  const full = p.health === null || p.health >= maxPips(p) * STORY.stagesPerPip
  if (!full) pool.push('heal')
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3).map((id) => ({ id, price: priceOf(id, p), sold: false }))
}

/** Arriving in the hub: restock once per visit, reset the reroll fee. */
export function arriveInHub() {
  const visit = state.visit + 1
  const next = { ...state, visit }
  progressStore.set({ visit, stock: rollStock(next), stockVisit: visit, rerollPrice: STORY.rerollStart })
}

/** Buy an offer: returns false if you can't afford it or it's gone. */
export function buy(index: number): boolean {
  const o = state.stock[index]
  if (!o || o.sold || state.gold < o.price) return false
  const p = state
  const upgrades = { ...p.upgrades }
  let weapons = p.weapons
  const improved = { ...p.improved }
  let health = p.health
  if (o.id in upgrades) upgrades[o.id as UpgradeId]++
  else if (o.id === 'heal') health = Math.min(maxPips(p) * STORY.stagesPerPip, (health ?? 0) + 2 * STORY.stagesPerPip)
  else if (o.id.startsWith('improve-')) {
    const w = o.id.slice(8) as WeaponId
    improved[w] = (improved[w] ?? 0) + 1
  } else weapons = [...weapons, o.id as WeaponId]
  // A health upgrade adds a full new pip to your current health too.
  if (o.id === 'health' && health !== null) health += STORY.stagesPerPip
  progressStore.set({
    gold: p.gold - o.price,
    upgrades,
    weapons,
    improved,
    health,
    bought: { ...p.bought, [o.id]: (p.bought[o.id] ?? 0) + 1 },
    stock: p.stock.map((s, i) => (i === index ? { ...s, sold: true } : s)),
  })
  return true
}

export function reroll(): boolean {
  if (state.gold < state.rerollPrice) return false
  const gold = state.gold - state.rerollPrice
  progressStore.set({ gold, stock: rollStock({ ...state, gold }), rerollPrice: Math.round((state.rerollPrice * STORY.rerollGrowth) / 10) * 10 })
  return true
}
