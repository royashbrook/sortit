// all audio is synthesised right here: zero sound files keeps the shell tiny
// and offline-first, and a synth "pop" is friendlier than a compressed sample.
// the context is created lazily on the first user gesture, because autoplay
// policy would leave an eagerly-created one permanently suspended.

const KEY = 'sortit:muted'

let ctx = null
let muted = false
try {
  muted = localStorage.getItem(KEY) === '1'
} catch { /* a blocked store never blocks the game */ }

function ac() {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext()
  // ios parks the context in 'interrupted' (not 'suspended') after a call,
  // siri, backgrounding, or a headphone route change, and it stays silent
  // until someone resumes it. so: any state that is not running gets a kick.
  if (ctx.state !== 'running') void ctx.resume().catch(() => { /* next kick */ })
  return ctx
}

// the kicks: coming back to the app, and any tap at all. without these the
// first sound AFTER an interruption is the one that dies, and on a phone that
// reads as "the sound keeps turning off". the ringer switch stays respected:
// webkit routes web audio as ambient, silent switch mutes it, that is correct.
document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx) ac() })
addEventListener('pointerdown', () => { if (ctx) ac() }, { passive: true, capture: true })

// one enveloped oscillator note. everything below is phrased with this.
function tone({ freq, glide = freq, type = 'sine', at = 0, len = 0.12, vol = 0.16 }) {
  const audio = ac()
  if (!audio || muted) return
  const t0 = audio.currentTime + at
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(glide, 1), t0 + len)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
  osc.connect(gain).connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + len + 0.05)
}

// one shaped noise burst: the percussive half of every material. a bandpass
// picks the body (glass rings high, stone thuds low), the envelope picks how
// hard the touch reads.
let noiseBuf = null
function noise({ at = 0, len = 0.08, vol = 0.1, freq = 2000, q = 1 }) {
  const audio = ac()
  if (!audio || muted) return
  if (!noiseBuf) {
    noiseBuf = audio.createBuffer(1, audio.sampleRate * 0.25, audio.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const t0 = audio.currentTime + at
  const src = audio.createBufferSource()
  src.buffer = noiseBuf
  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
  src.connect(filter).connect(gain).connect(audio.destination)
  src.start(t0)
  src.stop(t0 + len + 0.05)
}

// the landing phrase per material, played once per item at its own touchdown
// moment. `at` rides the audio clock, so a staggered convoy of nuts ratchets
// down one after another without a js timer in sight.
const MATERIALS = {
  glass(at, i) {
    tone({ freq: 1180 - i * 60, glide: 880, type: 'sine', at, len: 0.1, vol: 0.12 })
    noise({ at, len: 0.05, vol: 0.05, freq: 5200, q: 2 })
  },
  metal(at) {
    // the wind-down: three quick ratchet clicks while the nut spins home, then
    // the seat. click spacing matches the screw beat by ear, not by measure.
    for (let c = 0; c < 3; c++) noise({ at: Math.max(0, at - 0.14 + c * 0.05), len: 0.03, vol: 0.07, freq: 3300 + c * 400, q: 4 })
    tone({ freq: 620, glide: 520, type: 'triangle', at, len: 0.08, vol: 0.1 })
    noise({ at, len: 0.06, vol: 0.08, freq: 2100, q: 1.5 })
  },
  wood(at, i) {
    tone({ freq: 300 - i * 18, glide: 210, type: 'triangle', at, len: 0.09, vol: 0.13 })
    noise({ at, len: 0.05, vol: 0.07, freq: 900, q: 0.8 })
  },
  stone(at) {
    // the break: two crunches while the source block shudders, then the pop
    // where it respawns. spacing matches the breakpop keyframes by ear.
    noise({ at: Math.max(0, at - 0.2), len: 0.06, vol: 0.09, freq: 900, q: 0.7 })
    noise({ at: Math.max(0, at - 0.1), len: 0.07, vol: 0.11, freq: 600, q: 0.7 })
    tone({ freq: 150, glide: 90, type: 'sine', at, len: 0.12, vol: 0.16 })
    noise({ at, len: 0.09, vol: 0.1, freq: 420, q: 0.6 })
  },
  neon(at, i) {
    tone({ freq: 880 + i * 120, glide: 1500, type: 'sawtooth', at, len: 0.07, vol: 0.06 })
    tone({ freq: 440, glide: 660, type: 'square', at: at + 0.03, len: 0.05, vol: 0.04 })
  },
  pop(at, i) {
    tone({ freq: 340 + i * 30, glide: 150, type: 'sine', at, len: 0.14 })
  },
}

export const sound = {
  pick() { tone({ freq: 420, glide: 660, type: 'triangle', len: 0.09, vol: 0.12 }) },
  no() { tone({ freq: 140, glide: 110, type: 'square', len: 0.12, vol: 0.06 }) },
  // the move's whole audio: whoosh on launch, then the skin's material at each
  // item's landing time (flight.js computes those, Board passes them through)
  move(material, times) {
    noise({ at: 0, len: 0.16, vol: 0.03, freq: 700, q: 0.4 })
    const phrase = MATERIALS[material] ?? MATERIALS.pop
    times.forEach((t, i) => phrase(t, i))
  },
  reveal() {
    tone({ freq: 700, glide: 900, type: 'triangle', len: 0.08, vol: 0.09 })
    tone({ freq: 1050, glide: 1250, type: 'triangle', at: 0.07, len: 0.1, vol: 0.09 })
  },
  tube() { // a whole tube finished mid-game: a small fanfare, not the win one
    tone({ freq: 523, type: 'triangle', len: 0.1 })
    tone({ freq: 784, type: 'triangle', at: 0.09, len: 0.16 })
  },
  win() {
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => tone({ freq, type: 'triangle', at: i * 0.12, len: 0.22, vol: 0.18 }))
    tone({ freq: 1319, type: 'triangle', at: 0.48, len: 0.4, vol: 0.16 })
  },
  get muted() { return muted },
  toggle() {
    muted = !muted
    try { localStorage.setItem(KEY, muted ? '1' : '0') } catch { /* fine */ }
    return muted
  },
}
