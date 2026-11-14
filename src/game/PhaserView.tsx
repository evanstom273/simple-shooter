import { useEffect, useRef } from 'react'

// Hosts the Phaser game. Phaser is imported lazily so it lands in its own chunk.
export function PhaserView() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let destroy: (() => void) | undefined
    let cancelled = false

    void import('./createGame.ts').then(({ createGame }) => {
      if (cancelled || !host.current) return
      destroy = createGame(host.current).destroy
    })

    return () => {
      cancelled = true
      destroy?.()
    }
  }, [])

  return <div ref={host} className="absolute inset-0 touch-none select-none" />
}
