import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as RPointerEvent } from 'react'
import { STARTER_CHUNKS, type Chunk, type Dir, type Piece, type PieceType } from '../game/gen/chunks.ts'
import { chunkTestLevel } from '../game/gen/generate.ts'
import { chunkStore } from '../state/chunks.ts'
import { navStore } from '../state/nav.ts'

// The chunk editor (#79): draw chunks on a grid, play-test them, and they join
// the generator's pool. In the game (Testing → Chunk editor), desktop and touch.
// Chunks save on this device; "Copy" gives the data to hand to Claude to put
// them in the game for everyone.

type Tool = 'select' | 'erase' | PieceType

const TOOLS: { id: Tool; label: string; colour: string; hint: string }[] = [
  { id: 'select', label: 'Select', colour: '#e6e6f2', hint: 'Tap a piece to select it; drag to move; drag the corner to resize.' },
  { id: 'erase', label: 'Erase', colour: '#ff8a8a', hint: 'Tap pieces to remove them.' },
  { id: 'plat', label: 'Platform', colour: '#9aa0c8', hint: 'One-way: jump up through, drop down through.' },
  { id: 'block', label: 'Block', colour: '#5a5f88', hint: 'Solid on all sides; walls you can wall-jump.' },
  { id: 'spikes', label: 'Spikes', colour: '#f2f2fa', hint: 'Pick which way the points face.' },
  { id: 'saw', label: 'Saw', colour: '#ffb547', hint: 'Set its track (travel) once placed.' },
  { id: 'jet', label: 'Jet', colour: '#ff7b3d', hint: 'Fires on a timer in its direction.' },
  { id: 'pit', label: 'Pit', colour: '#c04a4a', hint: 'A gap in the floor (ground chunks only): bottomless.' },
  { id: 'mover', label: 'Mover', colour: '#6fb7ff', hint: 'Moving platform: set its travel once placed.' },
  { id: 'crumble', label: 'Crumble', colour: '#9a7a5a', hint: 'Falls after you stand on it; comes back.' },
  { id: 'bounce', label: 'Bounce', colour: '#7cf08a', hint: 'Launches you upwards.' },
  { id: 'conveyor', label: 'Conveyor', colour: '#8fd3ff', hint: 'Carries you left or right.' },
  { id: 'wind', label: 'Wind', colour: '#9fd8ff', hint: 'A zone that pushes you in its direction.' },
]
const HAS_DIR: PieceType[] = ['spikes', 'jet', 'conveyor', 'wind']
const HAS_TRAVEL: PieceType[] = ['mover', 'saw']

const blank = (): Chunk => ({ id: `c${Date.now().toString(36)}`, name: 'New chunk', kind: 'ground', w: 16, h: 12, pieces: [], custom: true })

/** Keep each piece type's shape rules (one tile thick, square saws, pits on the floor). */
function normalise(p: Piece, c: Chunk): Piece {
  const q = { ...p }
  const dir = q.dir
  if (['plat', 'crumble', 'conveyor', 'bounce', 'mover'].includes(q.t)) q.h = 1
  if (q.t === 'spikes' || q.t === 'jet') {
    if (dir === 'left' || dir === 'right') q.w = 1
    else q.h = 1
  }
  if (q.t === 'saw') q.w = q.h = Math.max(2, Math.min(4, Math.max(q.w, q.h)))
  if (q.t === 'pit') {
    q.y = c.h - 1
    q.h = 1
  }
  q.w = Math.max(1, Math.min(q.w, c.w))
  q.h = Math.max(1, Math.min(q.h, c.h))
  q.x = Math.max(0, Math.min(q.x, c.w - q.w))
  q.y = Math.max(0, Math.min(q.y, c.h - q.h))
  // Movers and saws stay inside the chunk for their whole trip, so they never cut into a neighbour.
  if (q.t === 'mover' || q.t === 'saw') {
    q.dx = Math.max(-q.x, Math.min(q.dx ?? 0, c.w - q.w - q.x))
    q.dy = Math.max(-q.y, Math.min(q.dy ?? 0, c.h - q.h - q.y))
  }
  return q
}

export function ChunkEditor() {
  const custom = useSyncExternalStore(chunkStore.subscribe, chunkStore.get)
  const startId = (() => {
    const d = navStore.get()
    return d.mode === 'editor' ? d.chunkId : undefined
  })()
  const [chunk, setChunk] = useState<Chunk>(() => custom.find((c) => c.id === startId) ?? custom[custom.length - 1] ?? blank())
  const [tool, setTool] = useState<Tool>('plat')
  const [dir, setDir] = useState<Dir>('up')
  const [sel, setSel] = useState<number | null>(null)
  const [history, setHistory] = useState<Chunk[]>([])
  const [dirty, setDirty] = useState(false)
  const [sheet, setSheet] = useState<null | 'copy' | 'paste'>(null)
  const [paste, setPaste] = useState('')
  const [note, setNote] = useState('')
  const readOnly = !chunk.custom

  const change = (next: Chunk) => {
    setHistory((h) => [...h.slice(-49), chunk])
    setChunk(next)
    setDirty(true)
  }
  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h
      setChunk(h[h.length - 1])
      setSel(null)
      return h.slice(0, -1)
    })
  }

  // Ctrl/Cmd+Z undo, Delete removes the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel !== null && !readOnly) {
        change({ ...chunk, pieces: chunk.pieces.filter((_, i) => i !== sel) })
        setSel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const save = (c = chunk) => {
    if (!c.custom) return
    chunkStore.put(c)
    setDirty(false)
    flash('Saved on this device')
  }
  const flash = (t: string) => {
    setNote(t)
    window.setTimeout(() => setNote(''), 1800)
  }
  const open = (c: Chunk) => {
    setChunk(c)
    setSel(null)
    setHistory([])
    setDirty(false)
  }
  const duplicate = () => {
    const c: Chunk = { ...structuredClone(chunk), id: `c${Date.now().toString(36)}`, name: `${chunk.name} copy`, custom: true }
    chunkStore.put(c)
    open(c)
    flash('Copied: this one is yours to edit')
  }
  const playTest = () => {
    if (chunk.custom) save()
    const level = chunkTestLevel(chunk)
    navStore.go({ mode: 'sandbox', level, title: `Testing: ${chunk.name}${level.unreachable ? ` · ${level.unreachable} unreachable` : ''}`, back: 'editor', chunkId: chunk.id })
  }

  const test = useMemo(() => chunkTestLevel(chunk), [chunk])
  const sel_ = sel !== null ? chunk.pieces[sel] : null
  const toolInfo = TOOLS.find((t) => t.id === tool)!

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0d0e18] text-sm text-neutral-200 select-none">
      {/* Top bar: which chunk, its name, kind and size. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-2">
        <button type="button" onClick={() => navStore.go({ mode: 'hub' })} className="rounded-lg bg-white/5 px-2.5 py-1.5 hover:bg-white/10">
          ← Hub
        </button>
        <select
          value={chunk.id}
          onChange={(e) => {
            const id = e.target.value
            if (id === '__new') {
              const c = blank()
              chunkStore.put(c)
              open(c)
              return
            }
            const c = custom.find((x) => x.id === id) ?? STARTER_CHUNKS.find((x) => x.id === id)
            if (c) open(c.custom ? c : { ...c })
          }}
          className="max-w-44 rounded-lg bg-white/5 px-2 py-1.5"
        >
          <option value="__new">+ New chunk</option>
          <optgroup label="Yours">
            {custom.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.off ? ' (off)' : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Claude's (copy to edit)">
            {STARTER_CHUNKS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
        <input
          value={chunk.name}
          disabled={readOnly}
          onChange={(e) => change({ ...chunk, name: e.target.value })}
          className="w-36 rounded-lg bg-white/5 px-2 py-1.5 disabled:opacity-60"
          aria-label="Chunk name"
        />
        <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10">
          {(['ground', 'air'] as const).map((k) => (
            <button
              key={k}
              type="button"
              disabled={readOnly}
              onClick={() => change({ ...chunk, kind: k, pieces: k === 'air' ? chunk.pieces.filter((p) => p.t !== 'pit') : chunk.pieces })}
              className={`px-2.5 py-1.5 capitalize ${chunk.kind === k ? 'bg-white/15 font-semibold' : 'bg-white/5'}`}
            >
              {k}
            </button>
          ))}
        </div>
        <Stepper label="W" value={chunk.w} min={4} max={60} disabled={readOnly} onChange={(w) => change({ ...chunk, w, pieces: chunk.pieces.map((p) => normalise(p, { ...chunk, w })) })} />
        <Stepper label="H" value={chunk.h} min={1} max={60} disabled={readOnly} onChange={(h) => change({ ...chunk, h, pieces: chunk.pieces.map((p) => normalise({ ...p, y: p.y + (h - chunk.h) }, { ...chunk, h })) })} />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {note && <span className="text-xs text-emerald-300">{note}</span>}
          {test.unreachable > 0 && <span className="rounded bg-amber-400/15 px-2 py-1 text-xs text-amber-300">{test.unreachable} unreachable with the base kit</span>}
          <button type="button" onClick={undo} disabled={!history.length} className="rounded-lg bg-white/5 px-2.5 py-1.5 hover:bg-white/10 disabled:opacity-40">
            Undo
          </button>
          {readOnly ? (
            <button type="button" onClick={duplicate} className="rounded-lg bg-sky-300/20 px-2.5 py-1.5 font-semibold text-sky-200 hover:bg-sky-300/30">
              Copy to edit
            </button>
          ) : (
            <button type="button" onClick={() => save()} className={`rounded-lg px-2.5 py-1.5 font-semibold ${dirty ? 'bg-emerald-400/25 text-emerald-200' : 'bg-white/5'}`}>
              Save
            </button>
          )}
          <button type="button" onClick={playTest} className="rounded-lg bg-neutral-100 px-3 py-1.5 font-bold text-neutral-900 hover:bg-white">
            Play-test
          </button>
        </div>
      </div>

      {/* Where it can appear, and whether it's in the pool. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-2 py-1.5 text-xs">
        <span className="text-neutral-400">Worlds</span>
        {[1, 2, 3, 4].map((w) => {
          const on = !chunk.worlds?.length || chunk.worlds.includes(w)
          return (
            <label key={w} className="flex items-center gap-1">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={on}
                onChange={() => {
                  const cur = chunk.worlds?.length ? chunk.worlds : [1, 2, 3, 4]
                  const next = on ? cur.filter((x) => x !== w) : [...cur, w].sort()
                  change({ ...chunk, worlds: next.length === 4 ? [] : next })
                }}
              />
              {w}
            </label>
          )
        })}
        <span className="ml-2 text-neutral-400">From section</span>
        <select value={chunk.minSection ?? 1} disabled={readOnly} onChange={(e) => change({ ...chunk, minSection: Number(e.target.value) })} className="rounded bg-white/5 px-1 py-0.5">
          {[1, 2, 3, 4].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {!readOnly && (
          <label className="ml-2 flex items-center gap-1">
            <input type="checkbox" checked={!chunk.off} onChange={() => change({ ...chunk, off: !chunk.off })} />
            In the random pool
          </label>
        )}
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => setSheet('copy')} className="rounded bg-white/5 px-2 py-1 hover:bg-white/10">
            Copy
          </button>
          <button type="button" onClick={() => setSheet('paste')} className="rounded bg-white/5 px-2 py-1 hover:bg-white/10">
            Paste
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`Delete "${chunk.name}"?`)) return
                chunkStore.remove(chunk.id)
                const rest = chunkStore.get()
                open(rest[rest.length - 1] ?? blank())
              }}
              className="rounded bg-red-400/10 px-2 py-1 text-red-300 hover:bg-red-400/20"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Tools. */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 p-1.5 md:w-32 md:flex-col md:overflow-y-auto md:border-r md:border-b-0">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={readOnly && t.id !== 'select'}
              onClick={() => {
                setTool(t.id)
                if (t.id !== 'select') setSel(null)
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs disabled:opacity-30 ${tool === t.id ? 'bg-white/15 font-semibold' : 'hover:bg-white/5'}`}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: t.colour }} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Context: direction / travel for the tool or the selected piece. */}
          <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-white/10 px-2 py-1.5 text-xs">
            <span className="text-neutral-400">{readOnly ? "Claude's chunk: copy it to edit." : sel_ ? `Selected: ${TOOLS.find((t) => t.id === sel_.t)?.label}` : toolInfo.hint}</span>
            {(sel_ ? HAS_DIR.includes(sel_.t) : HAS_DIR.includes(tool as PieceType)) && (
              <DirPicker
                value={sel_?.dir ?? dir}
                horizontalOnly={(sel_?.t ?? tool) === 'conveyor'}
                onChange={(d) => {
                  setDir(d)
                  if (sel_ && sel !== null && !readOnly) change({ ...chunk, pieces: chunk.pieces.map((p, i) => (i === sel ? normalise({ ...p, dir: d }, chunk) : p)) })
                }}
              />
            )}
            {sel_ && HAS_TRAVEL.includes(sel_.t) && !readOnly && (
              <>
                <span className="ml-2 text-neutral-400">Travel</span>
                <Stepper label="→" value={sel_.dx ?? 0} min={-sel_.x} max={chunk.w - sel_.w - sel_.x} onChange={(dx) => change({ ...chunk, pieces: chunk.pieces.map((p, i) => (i === sel ? normalise({ ...p, dx }, chunk) : p)) })} />
                <Stepper label="↓" value={sel_.dy ?? 0} min={-sel_.y} max={chunk.h - sel_.h - sel_.y} onChange={(dy) => change({ ...chunk, pieces: chunk.pieces.map((p, i) => (i === sel ? normalise({ ...p, dy }, chunk) : p)) })} />
              </>
            )}
            {sel_ && !readOnly && (
              <button
                type="button"
                onClick={() => {
                  change({ ...chunk, pieces: chunk.pieces.filter((_, i) => i !== sel) })
                  setSel(null)
                }}
                className="ml-auto rounded bg-red-400/10 px-2 py-1 text-red-300"
              >
                Remove piece
              </button>
            )}
          </div>
          <Grid chunk={chunk} tool={readOnly ? 'select' : tool} dir={dir} sel={sel} readOnly={readOnly} onSelect={setSel} onChange={change} />
        </div>
      </div>

      {sheet && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-4" onClick={() => setSheet(null)}>
          <div className="w-full max-w-lg rounded-xl bg-neutral-900 p-4 ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
            {sheet === 'copy' ? (
              <>
                <p className="mb-2 font-semibold">This chunk's data</p>
                <p className="mb-2 text-xs text-neutral-400">Send it to Claude to add it to the game for everyone, or paste it into the editor on another device.</p>
                <textarea readOnly value={JSON.stringify(chunk)} className="h-40 w-full rounded bg-black/40 p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(JSON.stringify(chunk)).then(
                      () => flash('Copied to clipboard'),
                      () => flash('Select the text and copy it'),
                    )
                    setSheet(null)
                  }}
                  className="mt-2 w-full rounded-lg bg-neutral-100 py-2 font-bold text-neutral-900"
                >
                  Copy to clipboard
                </button>
              </>
            ) : (
              <>
                <p className="mb-2 font-semibold">Paste chunk data</p>
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} className="h-40 w-full rounded bg-black/40 p-2 font-mono text-xs" placeholder='{"id": ..., "pieces": [...]}' />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const c = JSON.parse(paste) as Chunk
                      if (!Array.isArray(c.pieces) || !c.w || !c.h) throw new Error('not a chunk')
                      const mine: Chunk = { ...c, id: `c${Date.now().toString(36)}`, custom: true }
                      chunkStore.put(mine)
                      open(mine)
                      setPaste('')
                      setSheet(null)
                      flash('Pasted as a new chunk')
                    } catch {
                      flash("That isn't chunk data")
                    }
                  }}
                  className="mt-2 w-full rounded-lg bg-neutral-100 py-2 font-bold text-neutral-900"
                >
                  Add as a new chunk
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stepper({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  const btn = 'h-7 w-7 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30'
  return (
    <span className="flex items-center gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className={btn}>
        −
      </button>
      <span className="w-6 text-center tabular-nums">{value}</span>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className={btn}>
        +
      </button>
    </span>
  )
}

function DirPicker({ value, onChange, horizontalOnly }: { value: Dir; onChange: (d: Dir) => void; horizontalOnly?: boolean }) {
  const dirs: [Dir, string][] = horizontalOnly
    ? [
        ['left', '←'],
        ['right', '→'],
      ]
    : [
        ['up', '↑'],
        ['down', '↓'],
        ['left', '←'],
        ['right', '→'],
      ]
  return (
    <span className="flex gap-1">
      {dirs.map(([d, a]) => (
        <button key={d} type="button" onClick={() => onChange(d)} className={`h-7 w-7 rounded ${value === d ? 'bg-white/20 font-bold' : 'bg-white/5'}`} aria-label={`Face ${d}`}>
          {a}
        </button>
      ))}
    </span>
  )
}

/** The drawing grid: an SVG in tile units, with the floor (ground chunks) under it. */
function Grid({
  chunk,
  tool,
  dir,
  sel,
  readOnly,
  onSelect,
  onChange,
}: {
  chunk: Chunk
  tool: Tool
  dir: Dir
  sel: number | null
  readOnly: boolean
  onSelect: (i: number | null) => void
  onChange: (c: Chunk) => void
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<null | { mode: 'draw' | 'move' | 'size'; x0: number; y0: number; x: number; y: number; orig?: Piece }>(null)
  const pad = 2
  const floorH = chunk.kind === 'ground' ? 2 : 0

  const toTile = (e: RPointerEvent) => {
    const s = svg.current!
    const pt = s.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = s.getScreenCTM()!.inverse()
    const p = pt.matrixTransform(m)
    return { x: Math.floor(p.x), y: Math.floor(p.y) }
  }
  const hitPiece = (x: number, y: number) => {
    for (let i = chunk.pieces.length - 1; i >= 0; i--) {
      const p = chunk.pieces[i]
      const ext = HAS_TRAVEL.includes(p.t) ? 0 : 0
      if (x >= p.x - ext && x < p.x + p.w + ext && y >= p.y && y < p.y + p.h) return i
    }
    return -1
  }

  const down = (e: RPointerEvent) => {
    const t = toTile(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    if (tool === 'select') {
      const i = hitPiece(t.x, t.y)
      onSelect(i >= 0 ? i : null)
      if (i >= 0 && !readOnly) {
        const p = chunk.pieces[i]
        const corner = t.x === p.x + p.w - 1 && t.y === p.y + p.h - 1 && (p.w > 1 || p.h > 1)
        setDrag({ mode: corner ? 'size' : 'move', x0: t.x, y0: t.y, x: t.x, y: t.y, orig: p })
      }
      return
    }
    if (tool === 'erase') {
      const i = hitPiece(t.x, t.y)
      if (i >= 0) onChange({ ...chunk, pieces: chunk.pieces.filter((_, j) => j !== i) })
      return
    }
    if (t.x < 0 || t.y < 0 || t.x >= chunk.w || t.y >= chunk.h) return
    setDrag({ mode: 'draw', x0: t.x, y0: t.y, x: t.x, y: t.y })
  }
  const move = (e: RPointerEvent) => {
    if (!drag) {
      if (tool === 'erase' && e.buttons === 1) {
        const t = toTile(e)
        const i = hitPiece(t.x, t.y)
        if (i >= 0) onChange({ ...chunk, pieces: chunk.pieces.filter((_, j) => j !== i) })
      }
      return
    }
    const t = toTile(e)
    setDrag({ ...drag, x: t.x, y: t.y })
  }
  const up = () => {
    if (!drag) return
    if (drag.mode === 'draw' && tool !== 'select' && tool !== 'erase') {
      const x = Math.min(drag.x0, drag.x)
      const y = Math.min(drag.y0, drag.y)
      const w = Math.abs(drag.x - drag.x0) + 1
      const h = Math.abs(drag.y - drag.y0) + 1
      if (tool === 'pit' && chunk.kind !== 'ground') {
        setDrag(null)
        return
      }
      const defaults: Partial<Piece> = tool === 'mover' ? { dx: 10, dy: 0 } : tool === 'saw' ? { dx: 8, dy: 0 } : {}
      const dirFor = tool === 'conveyor' ? (dir === 'left' || dir === 'right' ? dir : 'right') : HAS_DIR.includes(tool) ? dir : undefined
      const piece = normalise({ t: tool, x, y, w: tool === 'bounce' ? Math.max(w, 3) : w, h, ...(dirFor ? { dir: dirFor } : {}), ...defaults }, chunk)
      onChange({ ...chunk, pieces: [...chunk.pieces, piece] })
      onSelect(chunk.pieces.length)
    } else if ((drag.mode === 'move' || drag.mode === 'size') && drag.orig && sel !== null) {
      const o = drag.orig
      const dx = drag.x - drag.x0
      const dy = drag.y - drag.y0
      if (dx || dy) {
        const next = drag.mode === 'move' ? { ...o, x: o.x + dx, y: o.y + dy } : { ...o, w: Math.max(1, o.w + dx), h: Math.max(1, o.h + dy) }
        onChange({ ...chunk, pieces: chunk.pieces.map((p, i) => (i === sel ? normalise(next, chunk) : p)) })
      }
    }
    setDrag(null)
  }

  // What's being drawn / moved right now.
  let ghost: Piece | null = null
  if (drag?.mode === 'draw' && tool !== 'select' && tool !== 'erase') {
    ghost = normalise({ t: tool, x: Math.min(drag.x0, drag.x), y: Math.min(drag.y0, drag.y), w: Math.abs(drag.x - drag.x0) + 1, h: Math.abs(drag.y - drag.y0) + 1, dir: HAS_DIR.includes(tool) ? dir : undefined }, chunk)
  }
  const shown = chunk.pieces.map((p, i) => {
    if (drag && drag.orig && i === sel && (drag.mode === 'move' || drag.mode === 'size')) {
      const dx = drag.x - drag.x0
      const dy = drag.y - drag.y0
      return normalise(drag.mode === 'move' ? { ...drag.orig, x: drag.orig.x + dx, y: drag.orig.y + dy } : { ...drag.orig, w: Math.max(1, drag.orig.w + dx), h: Math.max(1, drag.orig.h + dy) }, chunk)
    }
    return p
  })

  return (
    <div className="relative min-h-0 flex-1 p-2">
      <svg
        ref={svg}
        viewBox={`${-pad} ${-pad} ${chunk.w + pad * 2} ${chunk.h + pad * 2 + floorH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrag(null)}
      >
        <rect x={0} y={0} width={chunk.w} height={chunk.h} fill="#151626" />
        {/* Grid lines; every fifth a little brighter. A single jump is ~10 tiles, a double ~18. */}
        {Array.from({ length: chunk.w + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i} y1={0} x2={i} y2={chunk.h} stroke={i % 5 === 0 ? '#2e3050' : '#1f2036'} strokeWidth={0.05} />
        ))}
        {Array.from({ length: chunk.h + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i} x2={chunk.w} y2={i} stroke={(chunk.h - i) % 5 === 0 ? '#2e3050' : '#1f2036'} strokeWidth={0.05} />
        ))}
        {chunk.kind === 'ground' && (
          <>
            <rect x={-pad} y={chunk.h} width={chunk.w + pad * 2} height={floorH} fill="#4a4c66" />
            {/* Jump heights from the floor. */}
            <line x1={-pad} x2={chunk.w + pad} y1={chunk.h - 10} y2={chunk.h - 10} stroke="#7cf08a" strokeWidth={0.06} strokeDasharray="0.4 0.4" opacity={0.5} />
            <line x1={-pad} x2={chunk.w + pad} y1={chunk.h - 18} y2={chunk.h - 18} stroke="#8fd3ff" strokeWidth={0.06} strokeDasharray="0.4 0.4" opacity={0.5} />
          </>
        )}
        {shown.map((p, i) => (
          <PieceShape key={i} p={p} selected={i === sel} floorY={chunk.h} />
        ))}
        {ghost && <PieceShape p={ghost} ghost floorY={chunk.h} />}
        <rect x={0} y={0} width={chunk.w} height={chunk.h} fill="none" stroke="#6a6e96" strokeWidth={0.08} />
      </svg>
      {chunk.kind === 'ground' && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 text-[10px] text-neutral-500">
          <span className="text-emerald-300/70">– – single jump</span>
          <span className="text-sky-300/70">– – double jump</span>
        </div>
      )}
    </div>
  )
}

function PieceShape({ p, selected, ghost, floorY }: { p: Piece; selected?: boolean; ghost?: boolean; floorY: number }) {
  const op = ghost ? 0.5 : 1
  const stroke = selected ? '#ffd34d' : '#1a1a26'
  const sw = selected ? 0.18 : 0.08
  const arrow = (d?: Dir) => (d === 'up' ? '↑' : d === 'down' ? '↓' : d === 'left' ? '←' : '→')
  const cx = p.x + p.w / 2
  const cy = p.y + p.h / 2
  switch (p.t) {
    case 'plat':
      return <rect x={p.x} y={p.y} width={p.w} height={0.6} fill="#9aa0c8" stroke={stroke} strokeWidth={sw} opacity={op} />
    case 'block':
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#5a5f88" stroke={stroke} strokeWidth={sw} opacity={op} />
    case 'crumble':
      return <rect x={p.x} y={p.y} width={p.w} height={0.6} fill="#9a7a5a" stroke={stroke} strokeWidth={sw} strokeDasharray="0.3 0.2" opacity={op} />
    case 'conveyor':
      return (
        <g opacity={op}>
          <rect x={p.x} y={p.y} width={p.w} height={1} fill="#34364e" stroke={stroke} strokeWidth={sw} />
          <text x={cx} y={p.y + 0.8} fontSize={0.9} textAnchor="middle" fill="#8fd3ff">
            {arrow(p.dir)}
            {arrow(p.dir)}
          </text>
        </g>
      )
    case 'bounce':
      return (
        <g opacity={op}>
          <rect x={p.x} y={p.y + 0.5} width={p.w} height={0.5} fill="#7cf08a" stroke={stroke} strokeWidth={sw} />
          <text x={cx} y={p.y + 0.4} fontSize={0.8} textAnchor="middle" fill="#7cf08a">
            ⇡
          </text>
        </g>
      )
    case 'spikes': {
      const d = p.dir ?? 'up'
      const n = d === 'up' || d === 'down' ? p.w : p.h
      const tris = Array.from({ length: n }, (_, i) => {
        if (d === 'up') return `${p.x + i},${p.y + 1} ${p.x + i + 0.5},${p.y} ${p.x + i + 1},${p.y + 1}`
        if (d === 'down') return `${p.x + i},${p.y} ${p.x + i + 0.5},${p.y + 1} ${p.x + i + 1},${p.y}`
        if (d === 'left') return `${p.x + 1},${p.y + i} ${p.x},${p.y + i + 0.5} ${p.x + 1},${p.y + i + 1}`
        return `${p.x},${p.y + i} ${p.x + 1},${p.y + i + 0.5} ${p.x},${p.y + i + 1}`
      })
      return (
        <g opacity={op}>
          {tris.map((pt, i) => (
            <polygon key={i} points={pt} fill="#f2f2fa" stroke={selected ? '#ffd34d' : '#ff5a5a'} strokeWidth={0.06} />
          ))}
        </g>
      )
    }
    case 'saw':
      return (
        <g opacity={op}>
          {(p.dx || p.dy) && <line x1={cx} y1={cy} x2={cx + (p.dx ?? 0)} y2={cy + (p.dy ?? 0)} stroke="#ffb547" strokeWidth={0.12} strokeDasharray="0.3 0.3" />}
          <circle cx={cx} cy={cy} r={p.w / 2} fill="#ffb547" stroke={stroke} strokeWidth={sw} />
          {(p.dx || p.dy) && <circle cx={cx + (p.dx ?? 0)} cy={cy + (p.dy ?? 0)} r={p.w / 2} fill="none" stroke="#ffb547" strokeWidth={0.08} opacity={0.5} />}
        </g>
      )
    case 'jet': {
      const d = p.dir ?? 'up'
      const reach = 15
      const fx = d === 'left' ? p.x - reach : d === 'right' ? p.x + p.w : p.x
      const fy = d === 'up' ? p.y - reach : d === 'down' ? p.y + p.h : p.y
      const fw = d === 'left' || d === 'right' ? reach : p.w
      const fh = d === 'up' || d === 'down' ? reach : p.h
      return (
        <g opacity={op}>
          <rect x={fx} y={fy} width={fw} height={fh} fill="#ff7b3d" opacity={0.15} />
          <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#3a3c58" stroke={selected ? '#ffd34d' : '#ff7b3d'} strokeWidth={sw} />
        </g>
      )
    }
    case 'pit':
      return <rect x={p.x} y={floorY - 0.2} width={p.w} height={2.4} fill="#0a0a10" stroke={selected ? '#ffd34d' : '#c04a4a'} strokeWidth={sw} strokeDasharray="0.3 0.2" opacity={op} />
    case 'mover':
      return (
        <g opacity={op}>
          <rect x={p.x + (p.dx ?? 0)} y={p.y + (p.dy ?? 0)} width={p.w} height={0.6} fill="none" stroke="#6fb7ff" strokeWidth={0.08} strokeDasharray="0.3 0.2" />
          <line x1={cx} y1={p.y + 0.3} x2={cx + (p.dx ?? 0)} y2={p.y + 0.3 + (p.dy ?? 0)} stroke="#6fb7ff" strokeWidth={0.08} strokeDasharray="0.3 0.3" />
          <rect x={p.x} y={p.y} width={p.w} height={0.6} fill="#6fb7ff" stroke={stroke} strokeWidth={sw} />
        </g>
      )
    case 'wind':
      return (
        <g opacity={op}>
          <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#9fd8ff" opacity={0.12} stroke={selected ? '#ffd34d' : '#9fd8ff'} strokeWidth={sw} strokeDasharray="0.4 0.3" />
          <text x={cx} y={cy + 0.4} fontSize={Math.min(3, Math.max(1, Math.min(p.w, p.h) / 2))} textAnchor="middle" fill="#cfeaff" opacity={0.7}>
            {arrow(p.dir)}
          </text>
        </g>
      )
  }
}
