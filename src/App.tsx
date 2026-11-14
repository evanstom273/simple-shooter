import { useEffect, useState } from 'react'
import { PhaserView } from './game/PhaserView.tsx'
import { restartBus } from './state/run.ts'
import { Hud } from './ui/Hud.tsx'

// Phaser renders the game; React draws UI panels on top of it (GAME_DESIGN #5).
export default function App() {
  // A new run remounts the game entirely, so every system starts fresh (#17).
  const [run, setRun] = useState(0)
  useEffect(() => restartBus.on(() => setRun((r) => r + 1)), [])
  return (
    <div className="relative h-full w-full overflow-hidden">
      <PhaserView key={run} />
      <Hud />
    </div>
  )
}
