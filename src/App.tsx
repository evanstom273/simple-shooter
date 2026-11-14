import { PhaserView } from './game/PhaserView.tsx'
import { Hud } from './ui/Hud.tsx'

// Phaser renders the game; React draws UI panels on top of it (GAME_DESIGN #5).
export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <PhaserView />
      <Hud />
    </div>
  )
}
