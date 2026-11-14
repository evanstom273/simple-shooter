import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { setMuted, unlockAudio } from '../audio/sfx.ts'
import { loadSettings, saveSettings, type Settings } from '../persist/settings.ts'
import { AIM_MODES, defaultAimMode, settingsStore } from '../settings/store.ts'
import { hudStore } from '../state/hud.ts'
import { debugBus, type EnemyKind } from '../state/debug.ts'
import { navStore } from '../state/nav.ts'
import { restartBus, runStore } from '../state/run.ts'

// React UI layer over the Phaser canvas. pointer-events-none so the game still
// gets input; give interactive children pointer-events-auto.
export function Hud() {
  const [settings, setSettings] = useState<Settings>({ muted: false, aimMode: defaultAimMode() })
  const [open, setOpen] = useState(false)
  const hud = useSyncExternalStore(hudStore.subscribe, hudStore.get)
  const run = useSyncExternalStore(runStore.subscribe, runStore.get)

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

      {/* Health (#48): each pip shows how many of its stages are left, filling from the bottom. */}
      <div className="relative flex items-center gap-1.5" aria-label={`Health ${hud.health} of ${hud.pips * hud.stagesPerPip}`} role="img">
        {Array.from({ length: hud.pips }, (_, i) => {
          const stages = Math.max(0, Math.min(hud.stagesPerPip, hud.health - i * hud.stagesPerPip))
          const full = stages === hud.stagesPerPip
          return (
            <span
              key={i === hud.healedPip ? `p${i}-${hud.healCount}` : `p${i}`}
              className={`relative h-3.5 w-3.5 overflow-hidden rounded-[3px] ring-1 transition-all duration-200 ${full ? 'bg-neutral-100 shadow-[0_0_8px_rgba(255,255,255,0.35)] ring-white/0' : 'bg-white/10 ring-white/20'} ${stages === 0 ? 'scale-75' : ''} ${full && i === hud.healedPip ? 'heal-pop' : ''}`}
            >
              {!full && stages > 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-neutral-100 transition-[height] duration-200" style={{ height: `${(stages / hud.stagesPerPip) * 100}%` }} />
              )}
            </span>
          )
        })}
      </div>
      {/* Weapons you own (#68): current highlighted, ammo bar, fills back up while reloading. */}
      {hud.weapons.length > 0 && (
        <div className="relative mt-2 flex items-end gap-1.5">
          {hud.weapons.map((w, i) => {
            const current = w.id === hud.currentWeapon
            const fill = w.reloading !== null ? w.reloading : w.ammo / w.magazine
            return (
              <div
                key={w.id}
                className={`flex flex-col items-center gap-0.5 rounded-md px-1.5 pt-1 pb-0.5 ring-1 ${current ? 'bg-white/10 ring-white/40' : 'bg-white/5 opacity-60 ring-white/10'}`}
                title={`${i + 1}: ${WEAPON_ICONS[w.id].label}`}
              >
                <svg viewBox="0 0 28 14" width="28" height="14" aria-label={WEAPON_ICONS[w.id].label} className={w.reloading !== null ? 'opacity-40' : ''}>
                  <path d={WEAPON_ICONS[w.id].path} fill={WEAPON_ICONS[w.id].colour} />
                </svg>
                <div className="h-1 w-7 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${w.reloading !== null ? 'bg-white/50' : 'bg-white'}`} style={{ width: `${fill * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Gold in hand and run score (#53). */}
      <div className="relative mt-1.5 flex items-center gap-3 text-xs tabular-nums">
        <span className="flex items-center gap-1 font-bold text-amber-300">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M6 0l6 6-6 6-6-6z" fill="currentColor" />
          </svg>
          {run.gold}
        </span>
        {run.mode === 'endless' && <span className="text-neutral-400">score {run.score}</span>}
        {run.mode === 'section' && (
          <span className="text-neutral-400">
            World {run.world} · Section {run.section}
          </span>
        )}
      </div>
      <p className="relative mt-2 hidden pr-28 text-xs text-neutral-500 [@media(pointer:fine)]:block">
        A / D move · Space jump (twice to double jump) · S drop through · Right-click dash · Land on enemies to stomp · Left-click shoot · 1–3 / wheel switch gun
        {run.mode === 'hub' && ' · W / ↑ buy or enter a portal'}
      </p>

      {/* Wave readout (#13, #18). */}
      {run.phase === 'fighting' && (
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 items-baseline gap-2 rounded-full bg-black/40 px-3 py-1 ring-1 ring-white/10">
          <span className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">Wave</span>
          <span className="text-sm font-bold text-neutral-100 tabular-nums">
            {run.wave}
            {run.mode === 'section' && <span className="text-neutral-400"> / 5</span>}
          </span>
          <span className="text-xs text-neutral-400 tabular-nums">· {run.left} left</span>
        </div>
      )}

      {/* Wave start banner. */}
      {run.phase === 'fighting' && run.waveStarts > 0 && (
        <div key={`w${run.waveStarts}`} className="wave-banner absolute inset-x-0 top-[30%] text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-neutral-400 uppercase">Wave</p>
          <p className="text-6xl font-black text-neutral-100 tabular-nums">{run.wave}</p>
        </div>
      )}

      {/* Between waves: what you earned, counting up, and the countdown. */}
      {run.phase === 'intermission' && (
        <div className="absolute inset-x-0 top-[22%] flex justify-center">
          <div className="rounded-2xl bg-black/55 px-6 py-4 text-center ring-1 ring-white/10 backdrop-blur-sm">
            {run.wave > 1 ? (
              <>
                <p className="text-xs font-semibold tracking-[0.25em] text-neutral-400 uppercase">Wave {run.wave - 1} cleared</p>
                <p className="mt-1 text-3xl font-black text-amber-300 tabular-nums">
                  +<CountUp value={run.waveGold} /> <span className="text-base font-bold">gold</span>
                </p>
              </>
            ) : (
              <>
                {run.mode === 'section' && (
                  <p className="text-sm font-black tracking-[0.2em] text-neutral-100 uppercase">
                    World {run.world} · Section {run.section}
                  </p>
                )}
                <p className="text-xs font-semibold tracking-[0.25em] text-neutral-400 uppercase">Get ready</p>
              </>
            )}
            <p className="mt-2 text-sm text-neutral-300">
              Wave {run.wave} in <span className="font-bold text-neutral-100 tabular-nums">{Math.ceil(run.countdown)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Story section cleared (#62): gold and damage carry back to the hub. */}
      {run.phase === 'cleared' && (
        <div className="wave-banner absolute inset-x-0 top-[26%] text-center">
          <p className="text-xs font-semibold tracking-[0.3em] text-neutral-400 uppercase">
            World {run.world} · Section {run.section}
          </p>
          <p className="text-5xl font-black text-neutral-100">Cleared</p>
          <p className="mt-2 text-sm text-amber-300 tabular-nums">{run.gold} gold to spend</p>
        </div>
      )}

      {/* Story death (#62, #70): the gold you carried is gone; back to the hub, healed. */}
      {run.phase === 'dead' && (
        <div className="run-over absolute inset-0 grid place-items-center bg-black/60">
          <div className="text-center">
            <p className="text-5xl font-black text-red-300">You died</p>
            <p className="mt-2 text-sm text-neutral-400 tabular-nums">
              {run.lostGold > 0 ? `${run.lostGold} gold lost` : 'Nothing lost but pride'}
            </p>
          </div>
        </div>
      )}

      {/* Run over (#17): everything resets; the score is recorded as a high score (#53). */}
      {run.phase === 'over' && (
        <div className="run-over pointer-events-auto absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="w-72 rounded-2xl bg-neutral-900/95 p-6 text-center ring-1 ring-white/10">
            <p className="text-xs font-semibold tracking-[0.3em] text-neutral-400 uppercase">Run over</p>
            <p className="mt-2 text-5xl font-black text-neutral-100 tabular-nums">{run.score}</p>
            <p className="text-xs text-neutral-400">score</p>
            {run.newBest && <p className="mt-2 text-sm font-bold text-amber-300">New best!</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="font-bold text-neutral-100 tabular-nums">{run.wave}</p>
                <p className="text-[11px] text-neutral-500">wave</p>
              </div>
              <div>
                <p className="font-bold text-neutral-100 tabular-nums">{run.kills}</p>
                <p className="text-[11px] text-neutral-500">kills</p>
              </div>
              <div>
                <p className="font-bold text-neutral-100 tabular-nums">{Math.max(run.best, run.score)}</p>
                <p className="text-[11px] text-neutral-500">best</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => restartBus.restart()}
              className="mt-5 w-full rounded-xl bg-neutral-100 py-2.5 font-bold text-neutral-900 hover:bg-white active:scale-[0.98]"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={() => navStore.go({ mode: 'hub' })}
              className="mt-2 w-full rounded-xl bg-white/5 py-2.5 font-bold text-neutral-200 hover:bg-white/10 active:scale-[0.98]"
            >
              Back to the hub
            </button>
          </div>
        </div>
      )}

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
          <p className="mt-3 mb-1 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Testing</p>
          <div className="mb-1.5 flex items-center gap-1">
            <span className="mr-1 w-10 text-xs text-neutral-400">Give</span>
            {(['pistol', 'automatic', 'shotgun'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => debugBus.give(id)}
                aria-label={`Give ${WEAPON_ICONS[id].label}`}
                title={`Give ${WEAPON_ICONS[id].label}`}
                className="grid h-8 w-10 place-items-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20"
              >
                <svg viewBox="0 0 28 14" width="24" height="12" aria-hidden="true">
                  <path d={WEAPON_ICONS[id].path} fill={WEAPON_ICONS[id].colour} />
                </svg>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 w-10 text-xs text-neutral-400">Spawn</span>
            {SPAWN_BUTTONS.map((b) => (
              <button
                key={b.kind}
                type="button"
                onClick={() => debugBus.spawn(b.kind)}
                aria-label={`Spawn ${b.label}`}
                title={`Spawn ${b.label}`}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/20"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d={b.path} fill={b.colour} />
                </svg>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-3 w-full rounded-lg bg-white/5 py-1.5 text-neutral-300 hover:bg-white/10">
            Close
          </button>
        </div>
      )}
    </div>
  )
}

const SPAWN_BUTTONS: { kind: EnemyKind; label: string; colour: string; path: string }[] = [
  { kind: 'melee', label: 'melee enemy', colour: '#ff8a2a', path: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z' },
  { kind: 'ranged', label: 'ranged enemy', colour: '#5ee36a', path: 'M21 12L5 5.5v13z' },
  { kind: 'tank', label: 'tank', colour: '#e0453a', path: 'M12 3l8.6 6.2-3.3 10.1H6.7L3.4 9.2z' },
]

/** Counts up from 0 to `value` over about a second (the between-waves gold tally). */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    start.current = null
    let raf = 0
    const tick = (t: number) => {
      if (start.current === null) start.current = t
      const k = Math.min(1, (t - start.current) / 900)
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{shown}</>
}

const WEAPON_ICONS: Record<'pistol' | 'automatic' | 'shotgun', { label: string; colour: string; path: string }> = {
  pistol: { label: 'Pistol', colour: '#fff2b0', path: 'M3 4h16v4h-9v5H5V8H3z' },
  automatic: { label: 'Automatic', colour: '#ffd27a', path: 'M1 4h26v3H16v2h-3v4H8V7H1z' },
  shotgun: { label: 'Shotgun', colour: '#ffb38a', path: 'M2 3h20v3H2zM2 7h20v3H11v3H6v-3H2z' },
}
