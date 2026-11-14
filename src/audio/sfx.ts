// Synthesised sound effects (Web Audio): no audio files, small blips that
// suit the geometric look. Plain TS so both React (mute) and Phaser can use it.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let muted = false

const VOLUME = 0.5

/** Browsers only allow audio after a user gesture; call from the first tap/key. */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : VOLUME
    master.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

export function setMuted(m: boolean) {
  muted = m
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.02)
}

export function isMuted() {
  return muted
}

function ready() {
  return ctx && master && ctx.state === 'running' && !muted ? ctx : null
}

/** A pitched blip with a pitch sweep and a quick decay. */
function tone(type: OscillatorType, from: number, to: number, dur: number, vol: number, delay = 0) {
  const c = ready()
  if (!c) return
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(from, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Filtered noise burst, with the filter swept from → to. */
function noise(filter: BiquadFilterType, from: number, to: number, dur: number, vol: number, q = 1) {
  const c = ready()
  if (!c || !noiseBuf) return
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = c.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master!)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

const vary = (f: number) => f * (0.94 + Math.random() * 0.12)

export const sfx = {
  jump: () => tone('square', vary(260), vary(520), 0.12, 0.12),
  airJump: () => {
    tone('square', vary(420), vary(820), 0.1, 0.1)
    tone('triangle', vary(840), vary(1200), 0.08, 0.06, 0.02)
  },
  /** k: 0 (soft) … 1 (hard). */
  land: (k: number) => {
    tone('sine', vary(140), 50, 0.12 + 0.08 * k, 0.15 + 0.35 * k)
    noise('lowpass', 900, 200, 0.08 + 0.06 * k, 0.05 + 0.15 * k)
  },
  dash: () => noise('bandpass', 600, 3200, 0.18, 0.35, 1.5),
  dashImpact: () => {
    tone('sine', vary(120), 40, 0.18, 0.45)
    noise('lowpass', 1500, 150, 0.12, 0.25)
  },
  dashReady: () => tone('triangle', vary(880), vary(1320), 0.09, 0.06),
  skid: () => noise('highpass', 2500, 1200, 0.14, 0.08, 0.8),
  step: () => noise('bandpass', vary(1800), 900, 0.03, 0.03, 2),
  shoot: () => {
    tone('square', vary(880), vary(220), 0.07, 0.08)
    noise('highpass', 4000, 1500, 0.05, 0.12, 0.7)
  },
  spark: () => noise('highpass', vary(5000), 3000, 0.04, 0.05, 1),
  targetHit: () => tone('triangle', vary(520), vary(380), 0.05, 0.08),
  hurt: () => {
    tone('sawtooth', vary(320), 90, 0.25, 0.22)
    noise('lowpass', 2500, 300, 0.2, 0.25)
  },
  revive: () => {
    tone('triangle', vary(330), vary(660), 0.25, 0.12)
    tone('triangle', vary(495), vary(990), 0.25, 0.08, 0.08)
  },
  dashHit: () => {
    tone('square', vary(200), 70, 0.1, 0.18)
    noise('bandpass', 1800, 600, 0.08, 0.2, 1.2)
  },
  heal: () => {
    tone('sine', vary(660), vary(880), 0.18, 0.12)
    tone('sine', vary(990), vary(1320), 0.22, 0.09, 0.07)
    tone('triangle', vary(1320), vary(1760), 0.25, 0.05, 0.14)
  },
  enemyHop: () => tone('triangle', vary(300), vary(420), 0.04, 0.025),
  /** Rising whine over the wind-up (#40 tell). */
  windup: (seconds: number) => {
    const c = ready()
    if (!c) return
    const t = c.currentTime
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(220, t)
    o.frequency.exponentialRampToValueAtTime(880, t + seconds)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06, t + seconds * 0.8)
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.05)
    const f = c.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2200
    o.connect(f).connect(g).connect(master!)
    o.start(t)
    o.stop(t + seconds + 0.1)
  },
  roll: () => noise('lowpass', 400, 120, 0.5, 0.18, 2),
  leap: () => noise('bandpass', 500, 2400, 0.3, 0.2, 1.2),
  bounce: () => tone('square', vary(160), 80, 0.08, 0.12),
  dizzy: () => {
    tone('sine', vary(700), vary(500), 0.15, 0.05)
    tone('sine', vary(600), vary(800), 0.15, 0.04, 0.15)
  },
  enemyHit: () => tone('square', vary(400), vary(200), 0.06, 0.1),
  shatter: () => {
    noise('highpass', 3000, 800, 0.25, 0.25, 0.8)
    tone('triangle', vary(900), 200, 0.25, 0.12)
  },
  spawn: () => tone('sine', vary(200), vary(500), 0.4, 0.06),
  stomp: () => {
    tone('square', vary(140), vary(520), 0.12, 0.16)
    noise('lowpass', 1200, 200, 0.08, 0.2)
  },
  targetPop: () => {
    tone('sine', vary(600), 120, 0.2, 0.2)
    noise('bandpass', 2000, 400, 0.15, 0.12, 1)
  },
}
