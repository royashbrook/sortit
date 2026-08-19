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
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

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

export const sound = {
  pick() { tone({ freq: 420, glide: 660, type: 'triangle', len: 0.09, vol: 0.12 }) },
  drop() { tone({ freq: 340, glide: 150, type: 'sine', len: 0.14 }) },
  no() { tone({ freq: 140, glide: 110, type: 'square', len: 0.12, vol: 0.06 }) },
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
