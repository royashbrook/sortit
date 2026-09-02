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
  }
}

export function formatPlayTime(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
