// Testing tools (temporary, until waves exist): React buttons ask the game to spawn enemies.
export type EnemyKind = 'melee' | 'ranged' | 'tank'

const listeners = new Set<(kind: EnemyKind) => void>()

export const debugBus = {
  spawn(kind: EnemyKind) {
    listeners.forEach((l) => l(kind))
  },
  onSpawn(l: (kind: EnemyKind) => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
