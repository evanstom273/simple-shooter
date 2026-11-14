import { useEffect, useState } from 'react'
import { PhaserView } from './game/PhaserView.tsx'
import { navStore } from './state/nav.ts'
import { loadProgress } from './state/progress.ts'
import { restartBus } from './state/run.ts'
import { Hud } from './ui/Hud.tsx'

// Phaser renders the game; React draws UI panels on top of it (GAME_DESIGN #5).
export default function App() {
  // Story progress loads from Dexie before the hub appears (#70).
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void loadProgress().then(() => setReady(true))
  }, [])
  // Going anywhere (hub, a section, endless) or restarting remounts the game,
  // so every system starts fresh (#17, #72). A short fade covers the swap.
  const [mount, setMount] = useState(0)
  const [fade, setFade] = useState(false)
  useEffect(() => {
    const swap = () => {
      setFade(true)
      // Fade to black, swap, fade back in; the player beams in a second later (#75).
      window.setTimeout(() => {
        setMount((m) => m + 1)
        window.setTimeout(() => setFade(false), 150)
      }, 450)
    }
    const offNav = navStore.subscribe(swap)
    // "Play again" in endless: a fresh endless run.
    const offRestart = restartBus.on(() => navStore.go({ mode: 'endless' }))
    return () => {
      offNav()
      offRestart()
    }
  }, [])
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0e18]">
      {ready && <PhaserView key={mount} />}
      {ready && <Hud />}
      <div className={`pointer-events-none absolute inset-0 bg-black transition-opacity duration-[450ms] ${fade || !ready ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  )
}
