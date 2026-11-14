import { useEffect, useState } from 'react'
import { setMuted, unlockAudio } from '../audio/sfx.ts'
import { loadSettings, saveSettings } from '../persist/settings.ts'

// React UI layer over the Phaser canvas. pointer-events-none so the game still
// gets input; give interactive children pointer-events-auto.
export function Hud() {
  const [muted, setMutedState] = useState(false)

  useEffect(() => {
    void loadSettings().then((s) => {
      setMutedState(s.muted)
      setMuted(s.muted)
    })
    // Audio can only start after a user gesture.
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const toggle = () => {
    const m = !muted
    setMutedState(m)
    setMuted(m)
    void saveSettings({ muted: m })
  }

  return (
    <div className="pointer-events-none absolute inset-0 p-3">
      <p className="hidden text-xs text-neutral-500 [@media(pointer:fine)]:block">
        A / D move · Space jump (hold for higher, twice to double jump) · S drop through · Right-click dash
      </p>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
        aria-label={muted ? 'Unmute' : 'Mute'}
        title={muted ? 'Unmute' : 'Mute'}
        className="pointer-events-auto absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-neutral-300 ring-1 ring-white/15 hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
          {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
        </svg>
      </button>
    </div>
  )
}
