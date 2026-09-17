export type UpdateStatus = 'idle' | 'checking' | 'current' | 'downloading' | 'ready' | 'offline' | 'failed' | 'unavailable' | 'applying' | 'unsaved'
export interface UpdateState { status: UpdateStatus; ready: boolean }

export function startUpdates(publish: (state: UpdateState) => void, beforeUpdate: () => boolean) {
  const lifetime = new AbortController()
  const channels = new Set<() => void>()
  const base = new URL(import.meta.env.BASE_URL, location.href)
  const state: UpdateState = { status: 'idle', ready: false }
  let registration: ServiceWorkerRegistration | undefined
  let candidate: ServiceWorker | null = null
  let checking = false
  let checkAgain = false
  let interval: ReturnType<typeof setInterval> | undefined
  const disposed = () => lifetime.signal.aborted
  const set = (status: UpdateStatus, ready = state.ready) => {
    if (state.status === 'applying' && status !== 'applying') return
    if (!disposed()) { Object.assign(state, { status, ready }); publish({ ...state }) }
  }
  const identify = (worker: ServiceWorker | null) => new Promise<string | null>(resolve => {
    if (!worker || disposed()) return resolve(null)
    const channel = new MessageChannel()
    const close = () => {
      clearTimeout(timeout)
      channel.port1.close()
      channel.port2.close()
      channels.delete(close)
      resolve(null)
    }
    const timeout = setTimeout(close, 4000)
    channels.add(close)
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      resolve(typeof event.data === 'string' && /^[a-f0-9]{64}$/.test(event.data) ? event.data : null)
      close()
    }
    try { worker.postMessage({ type: 'SORTIT_VERSION' }, [channel.port2]) } catch { close() }
  })

  async function check() {
    if (disposed() || !registration || document.hidden || state.status === 'applying') return
    if (checking) { checkAgain = true; return }
    checking = true
    set('checking')
    try {
      const response = await fetch(new URL('release.json?update-probe', base), {
        cache: 'no-store', signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(8000)]),
      })
      if (!response.ok) throw new Error(`Update check: ${response.status}`)
      const identity: unknown = await response.json()
      if (!identity || typeof identity !== 'object' || !('fingerprint' in identity) ||
        typeof identity.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(identity.fingerprint)) throw new Error('Invalid update identity')
      let target = registration.waiting
      let fingerprint = await identify(target)
      if (disposed()) return
      // Reuse the downloaded build. An overlapping/redundant update can stall
      // the legacy Chromium handoff; installing state changes retry this check.
      if (!registration.installing && fingerprint !== identity.fingerprint) {
        await registration.update()
        if (disposed()) return
        target = registration.waiting ?? registration.active
        fingerprint = await identify(target)
      }
      if (disposed()) return
      if (fingerprint === __RELEASE__.fingerprint) {
        // The legacy network-first worker can serve the new page before its
        // replacement activates. This page already runs that downloaded build.
        if (registration.waiting === target) target?.postMessage({ type: 'SORTIT_ACTIVATE' })
        else navigator.serviceWorker.controller?.postMessage({ type: 'SORTIT_CLIENT', fingerprint })
      }
      if (fingerprint === identity.fingerprint && fingerprint !== __RELEASE__.fingerprint) {
        candidate = target
        set('ready', true)
      } else {
        candidate = null
        set(registration.installing ? 'downloading' : identity.fingerprint === __RELEASE__.fingerprint ? 'current' : 'failed', false)
      }
    } catch {
      set('offline')
    } finally {
      checking = false
      if (checkAgain) { checkAgain = false; void check() }
    }
  }

  const changed = () => {
    if (state.status === 'applying' && !disposed()) location.reload()
    else void check()
  }
  const watch = (worker: ServiceWorker | null) => worker?.addEventListener('statechange', () => {
    if (worker.state === 'installed' || worker.state === 'activated') void check()
    if (worker.state === 'redundant' && !disposed()) {
      if (worker === candidate) {
        candidate = null
        // A newer download can replace the selected waiting worker before it
        // handles activation. This is a real failure, not a stale check result.
        if (state.status === 'applying') state.status = 'failed'
        set('failed', false)
      } else if (!candidate) set('failed', false)
    }
  }, { signal: lifetime.signal })
  const visible = () => { if (!document.hidden) void check() }

  if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.addEventListener('controllerchange', changed, { signal: lifetime.signal })
    document.addEventListener('visibilitychange', visible, { signal: lifetime.signal })
    addEventListener('pageshow', visible, { signal: lifetime.signal })
    addEventListener('online', visible, { signal: lifetime.signal })
    void navigator.serviceWorker.register(new URL('service-worker.js', base), { updateViaCache: 'none' }).then(value => {
      if (disposed()) return
      registration = value
      watch(value.installing)
      watch(value.waiting)
      value.addEventListener('updatefound', () => watch(value.installing), { signal: lifetime.signal })
      interval = setInterval(visible, 300000)
      void check()
    }).catch(() => set('unavailable'))
  }

  return {
    check,
    apply() {
      if (disposed() || !state.ready || !candidate || state.status === 'applying') return
      if (!beforeUpdate()) { set('unsaved'); return }
      if (candidate.state === 'installed' && candidate === registration?.waiting) {
        set('applying')
        candidate.postMessage({ type: 'SORTIT_ACTIVATE' })
      } else if (candidate.state === 'activated' && candidate === navigator.serviceWorker.controller) {
        set('applying')
        location.reload()
      } else void check()
    },
    dispose() {
      lifetime.abort()
      clearInterval(interval)
      for (const close of channels) close()
    },
  }
}
