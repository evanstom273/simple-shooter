import { useEffect, useRef } from 'react'
import type Phaser from 'phaser'

// Hosts the Phaser game. Phaser is imported lazily so it lands in its own chunk.
export function PhaserView() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let game: Phaser.Game | undefined
    let cancelled = false

    void import('./createGame.ts').then(({ createGame }) => {
      if (cancelled || !host.current) return
      game = createGame(host.current)
    })

    return () => {
      cancelled = true
      game?.destroy(true)
    }
  }, [])

  return <div ref={host} className="absolute inset-0" />
}
