// Testing tools (temporary, until waves exist): React buttons ask the game to spawn enemies.
export type EnemyKind = 'melee' | 'ranged' | 'tank'

export type WeaponId = 'pistol' | 'automatic' | 'shotgun'

const listeners = new Set<(kind: EnemyKind) => void>()
const giveListeners = new Set<(id: WeaponId) => void>()

export const debugBus = {
  spawn(kind: EnemyKind) {
    listeners.forEach((l) => l(kind))
  },
  give(id: WeaponId) {
    giveListeners.forEach((l) => l(id))
  },
  onGive(l: (id: WeaponId) => void) {
    giveListeners.add(l)
    return () => {
      giveListeners.delete(l)
    }
  },
  onSpawn(l: (kind: EnemyKind) => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
