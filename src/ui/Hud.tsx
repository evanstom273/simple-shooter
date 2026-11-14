// React UI layer over the Phaser canvas. pointer-events-none so the game still
// gets input; give interactive children pointer-events-auto.
export function Hud() {
  return (
    <div className="pointer-events-none absolute inset-0 p-3">
      <p className="hidden text-xs text-neutral-500 [@media(pointer:fine)]:block">A / D move · Space jump</p>
    </div>
  )
}
