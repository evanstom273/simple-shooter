// React UI layer over the Phaser canvas. pointer-events-none so the game still
// gets input; give interactive children pointer-events-auto.
export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 p-4">
      <p className="text-sm text-neutral-400">simple-shooter · scaffold</p>
    </div>
  )
}
