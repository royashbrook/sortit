// Elapsed play time, not wall time. Backgrounding pauses the clock by moving
// its origin forward when play resumes, so a minute away adds zero seconds.
export function createPlayClock(now = () => Date.now()) {
  let startedAt = null
  let pausedAt = null
  let stoppedAt = null

  return {
    start(elapsed = 0, paused = false) {
      const t = now()
      startedAt = t - Math.max(0, elapsed)
      pausedAt = paused ? t : null
      stoppedAt = null
    },
    elapsed() {
      if (startedAt == null) return 0
      return Math.max(0, (stoppedAt ?? pausedAt ?? now()) - startedAt)
    },
    pause() {
      if (startedAt != null && pausedAt == null && stoppedAt == null) pausedAt = now()
    },
    resume() {
      if (startedAt == null || pausedAt == null || stoppedAt != null) return
      const t = now()
      startedAt += t - pausedAt
      pausedAt = null
    },
    stop() {
      if (startedAt == null || stoppedAt != null) return
      stoppedAt = pausedAt ?? now()
      pausedAt = null
    },
    clear() {
      startedAt = pausedAt = stoppedAt = null
    },
  }
}

// The game's clock: a play clock plus the rule for when it may run. It starts
// on the first move, not when the board opens, and it runs only while a live
// board is the thing on screen: not under a dialog, not behind the levels
// screen, not in a hidden tab, not after a win. Every gate change re-derives
// run/pause from the whole set, so releasing one gate (closing help) never
// restarts a clock that another gate (a hidden tab) still holds.
export function createSessionClock(now = () => Date.now()) {
  const clock = createPlayClock(now)
  const gates = { hidden: false, overlay: false, away: false }
  let started = false
  const sync = () => {
    if (!started) return
    if (gates.hidden || gates.overlay || gates.away) clock.pause()
    else clock.resume()
  }
  return {
    // a fresh board: nothing on the clock until the first move
    reset() { started = false; clock.clear() },
    // a board that already has moves on it comes back with its time, held
    // until every gate says play is on screen
    restore(elapsed) { started = true; clock.start(elapsed, true); sync() },
    begin() { if (started) return; started = true; clock.start(0, true); sync() },
    hold(gate, held) { gates[gate] = !!held; sync() },
    finish() { clock.stop() },
    elapsed: () => clock.elapsed(),
  }
}

export function formatPlayTime(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
