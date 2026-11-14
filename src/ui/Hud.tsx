import { useEffect, useState, useSyncExternalStore } from 'react'
import { setMuted, unlockAudio } from '../audio/sfx.ts'
import { loadSettings, saveSettings, type Settings } from '../persist/settings.ts'
import { AIM_MODES, defaultAimMode, settingsStore } from '../settings/store.ts'
import { hudStore } from '../state/hud.ts'

// React UI layer over the Phaser canvas. pointer-events-none so the game still
// gets input; give interactive children pointer-events-auto.
export function Hud() {
  const [settings, setSettings] = useState<Settings>({ muted: false, aimMode: defaultAimMode() })
  const [open, setOpen] = useState(false)
  const hud = useSyncExternalStore(hudStore.subscribe, hudStore.get)

  useEffect(() => {
    void loadSettings().then((s) => {
      setSettings(s)
      setMuted(s.muted)
      settingsStore.setAimMode(s.aimMode)
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

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setMuted(next.muted)
    settingsStore.setAimMode(next.aimMode)
    void saveSettings(next)
  }

  const iconButton =
    'pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/5 text-neutral-300 ring-1 ring-white/15 hover:bg-white/10'

  return (
    <div className="pointer-events-none absolute inset-0 p-3">
      {/* Keyed by the counters so the animation replays on every hit / revive. */}
      {hud.hurtCount > 0 && <div key={`h${hud.hurtCount}`} className="hurt-pulse absolute inset-0" />}
      {hud.deathCount > 0 && <div key={`d${hud.deathCount}`} className="revive-flash absolute inset-0" />}

      <div className="relative flex items-center gap-1.5" aria-label={`Health ${hud.health} of ${hud.maxHealth}`} role="img">
        {Array.from({ length: hud.maxHealth }, (_, i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-[3px] transition-all duration-200 ${i < hud.health ? 'bg-neutral-100 shadow-[0_0_8px_rgba(255,255,255,0.35)]' : 'scale-75 bg-white/10 ring-1 ring-white/20'}`}
          />
        ))}
      </div>
      <p className="relative mt-2 hidden pr-28 text-xs text-neutral-500 [@media(pointer:fine)]:block">
        A / D move · Space jump (twice to double jump) · S drop through · Right-click dash
      </p>

      <div className="absolute top-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={() => update({ muted: !settings.muted })}
          aria-label={settings.muted ? 'Unmute' : 'Mute'}
          title={settings.muted ? 'Unmute' : 'Mute'}
          className={iconButton}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none" />
            {settings.muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
          </svg>
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Settings" title="Settings" aria-expanded={open} className={iconButton}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="pointer-events-auto absolute top-14 right-3 w-64 rounded-xl bg-neutral-900/95 p-3 text-sm text-neutral-200 shadow-xl ring-1 ring-white/10">
          <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Aiming</p>
          <div className="flex flex-col gap-1">
            {AIM_MODES.map((m) => (
              <label key={m.id} className={`flex cursor-pointer gap-2 rounded-lg p-2 ${settings.aimMode === m.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <input type="radio" name="aim" className="mt-0.5 accent-sky-300" checked={settings.aimMode === m.id} onChange={(e) => {
                    update({ aimMode: m.id })
                    // Don't keep focus, or Space (jump) would press the radio again.
                    e.currentTarget.blur()
                  }} />
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-neutral-400">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full rounded-lg bg-white/5 py-1.5 text-neutral-300 hover:bg-white/10">
            Close
          </button>
        </div>
      )}
    </div>
  )
}
