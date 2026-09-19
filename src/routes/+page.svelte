<script lang="ts">
  import { onMount } from 'svelte'
  import { createStore, LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT } from '$lib/ui/store.svelte.ts'
  import { themeForWorld } from '$lib/engine/art/index.ts'
  import { dailySeed } from '$lib/engine/seed.ts'
  import type { Board as PuzzleBoard } from '$lib/engine/types.ts'
  import { SAVE_GENERATION_KEY } from '$lib/storage.ts'
  import { startUpdates, type UpdateState } from '$lib/ui/update.ts'
  import { sound } from '$lib/ui/sounds.ts'
  import QRCode from 'qrcode'
  import {
    codeFromHash,
    encodeSaveSlots,
    hasRollback,
    importSave,
    restoreRollback,
    saveLink,
  } from '$lib/ui/save-transfer.ts'
  import Board from '$lib/ui/Board.svelte'
  import Modal from '$lib/ui/Modal.svelte'

  const store = createStore()
  const version = __APP_VERSION__
  let previousScreen = store.screen

  $effect(() => {
    const screen = store.screen
    if (screen === previousScreen) return
    previousScreen = screen
    // Navigation removes its own focused control. Name and focus the new screen,
    // but leave initial mount and same-screen dialogs to their native behavior.
    document.getElementById(screen)!.focus({ preventScroll: true })
  })

  let muted = $state(sound.muted)
  let installEvent = $state<BeforeInstallPromptEvent | null>(null)
  let installable = $state(false)
  let iosInstall = $state(false)
  let updateState = $state<UpdateState>({ status: 'idle', ready: false })
  let updates: ReturnType<typeof startUpdates> | undefined
  let saveCode = $state('')
  let saveImport = $state('')
  let transferMsg = $state('')
  let qrShown = $state(false)
  let rollbackReady = $state(false)
  let saveCodeEl = $state<HTMLTextAreaElement>()
  let qrCanvas = $state<HTMLCanvasElement>()
  let transferBusy = $state(false)
  let transferRequest: AbortController | undefined
  let transferEpoch = 0
  let disposed = false
  const timers = new Set<ReturnType<typeof setTimeout>>()
  function later(run: () => void, delay: number) {
    if (disposed) return
    const id = setTimeout(() => { timers.delete(id); run() }, delay)
    timers.add(id)
  }

  // a shared link drops the player onto their friend's exact board
  onMount(() => {
    sound.mount()
    updates = startUpdates(value => updateState = value, () => store.flushSave())
    const params = new URLSearchParams(location.search)
    const lvl = Number.parseInt(params.get('level') ?? '', 10)
    const seed = Number.parseInt(params.get('seed') ?? '', 10)
    if (Number.isFinite(lvl) && lvl >= 1 && lvl <= LEVEL_COUNT) store.startLevel(lvl)
    else if (Number.isFinite(seed) && seed > 0) store.startSeed(seed)

    const incomingSave = codeFromHash(location.hash)
    if (incomingSave) {
      void openTransfer(incomingSave)
    }

    // install helper (shell): hidden until genuinely installable; ios gets a hint
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isInstalled = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    if (isIos && !isInstalled) { iosInstall = true; installable = true }
    const onInstallPrompt = (event: Event) => { event.preventDefault(); installEvent = event as BeforeInstallPromptEvent; installable = true }
    const onInstalled = () => { installable = false }
    addEventListener('beforeinstallprompt', onInstallPrompt)
    addEventListener('appinstalled', onInstalled)

    // two tabs sharing one store: adopt the better progress rather than clobber
    const onStorage = async (event: StorageEvent) => {
      if (event.key === SAVE_GENERATION_KEY) {
        store.reloadSave()
        sound.reloadSettings()
        muted = sound.muted
        if (store.dialog === 'transfer') {
          rollbackReady = hasRollback()
          await refreshSaveCode('save updated in another tab.')
        }
      }
      else if (event.key === 'sortit:progress') store.mergeExternalProgress()
    }
    addEventListener('storage', onStorage)

    const onVisibility = () => {
      store.setVisible(!document.hidden)
    }
    const onPageHide = () => store.setVisible(false)
    const onPageShow = () => store.setVisible(true)
    document.addEventListener('visibilitychange', onVisibility)
    addEventListener('pagehide', onPageHide)
    addEventListener('pageshow', onPageShow)
    return () => {
      disposed = true
      transferEpoch++
      transferRequest?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
      removeEventListener('pagehide', onPageHide)
      removeEventListener('pageshow', onPageShow)
      removeEventListener('beforeinstallprompt', onInstallPrompt)
      removeEventListener('appinstalled', onInstalled)
      removeEventListener('storage', onStorage)
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      updates?.dispose()
      store.dispose()
      sound.dispose()
    }
  })

  function toggleSound() { muted = store.toggleSound() }

  async function share(subject: PuzzleBoard | null) {
    const url = new URL(location.href)
    url.search = ''
    if (subject?.kind === 'level') url.searchParams.set('level', String(subject.n))
    else url.searchParams.set('seed', String(subject?.kind === 'seed' ? subject.seed : dailySeed()))
    const payload = { title: 'Sort It', text: 'play this exact Sort It puzzle with me', url: url.toString() }
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) { await navigator.share(payload); return 'shared' }
    } catch (e) { if (e instanceof Error && e.name === 'AbortError') return 'cancelled' }
    try { await navigator.clipboard.writeText(url.toString()); return 'copied' } catch { return 'failed' }
  }

  let winShareLabel = $state('SEND THIS PUZZLE TO A FRIEND')
  async function shareWin() {
    const r = await share(store.board)
    if (r === 'copied') { winShareLabel = 'LINK COPIED, SEND IT'; later(() => winShareLabel = 'SEND THIS PUZZLE TO A FRIEND', 2400) }
  }

  async function doInstall() {
    if (installEvent) {
      installEvent.prompt()
      await installEvent.userChoice
      installEvent = null
      installable = false // the prompt is one-shot: a dead button must not linger
      return
    }
    if (iosInstall) store.openDialog('ios-install')
  }

  async function refreshSaveCode(readyMessage: string) {
    const epoch = ++transferEpoch
    saveCode = ''
    qrShown = false
    transferMsg = 'building your save code...'
    try {
      const code = await encodeSaveSlots(store.saveSnapshot())
      if (disposed || epoch !== transferEpoch) return
      saveCode = code
      transferMsg = readyMessage
    } catch (error) {
      if (disposed || epoch !== transferEpoch) return
      saveCode = ''
      transferMsg = error instanceof Error ? error.message : 'your save could not be read.'
    }
  }

  async function openTransfer(incoming = '') {
    store.openDialog('transfer')
    saveImport = incoming
    rollbackReady = hasRollback()
    await refreshSaveCode(incoming ? 'a save arrived. tap LOAD THIS SAVE to use it.' : 'ready to move.')
  }

  async function copySave() {
    if (!saveCode) return
    let copied = false
    try { await navigator.clipboard.writeText(saveCode); copied = true } catch { /* select fallback below */ }
    if (!copied) {
      try { saveCodeEl?.select(); copied = document.execCommand('copy') } catch { /* manual copy remains */ }
    }
    transferMsg = copied ? 'copied. open the new shortcut and paste it here.' : 'select the code and copy it.'
  }

  async function showSaveQr() {
    if (!saveCode || !qrCanvas) return
    const epoch = transferEpoch
    transferMsg = 'building the QR code...'
    try {
      await QRCode.toCanvas(qrCanvas, saveLink(saveCode), { errorCorrectionLevel: 'L', margin: 2, width: 260 })
      if (disposed || epoch !== transferEpoch) return
      qrShown = true
      transferMsg = 'scan this with the other device.'
    } catch {
      if (disposed || epoch !== transferEpoch) return
      qrShown = false
      transferMsg = 'this save is too big for a QR code. use COPY SAVE CODE.'
    }
  }

  async function loadSave() {
    if (transferBusy) return
    if (!saveImport.trim()) { transferMsg = 'paste a save code first.'; return }
    if (!confirm('Replace this shortcut\'s progress? Its current save will be kept as a one-step rollback.')) return
    transferBusy = true
    const request = new AbortController()
    transferRequest = request
    try {
      await importSave(saveImport, undefined, undefined, request.signal)
      if (disposed || request.signal.aborted) return
      store.reloadSave()
      sound.reloadSettings()
      muted = sound.muted
      rollbackReady = hasRollback()
      clearSaveLink()
      await refreshSaveCode('progress moved.')
    } catch (error) {
      if (disposed || request.signal.aborted) return
      transferMsg = error instanceof Error ? error.message : 'that save code did not work.'
    } finally { if (transferRequest === request) { transferRequest = undefined; transferBusy = false } }
  }

  function clearSaveLink() {
    if (codeFromHash(location.hash)) history.replaceState(history.state, '', location.pathname + location.search)
  }

  function closeTransfer(close: () => void) {
    transferEpoch++
    transferRequest?.abort()
    close()
    clearSaveLink()
  }

  async function useRollback() {
    if (transferBusy) return
    if (!confirm('Put back the save from before the last transfer?')) return
    transferBusy = true
    try {
      restoreRollback()
      store.reloadSave()
      sound.reloadSettings()
      muted = sound.muted
      rollbackReady = hasRollback()
      await refreshSaveCode('old save restored.')
    } catch (error) {
      transferMsg = error instanceof Error ? error.message : 'the rollback could not be restored.'
    } finally { transferBusy = false }
  }

  function checkUpdates() { if (updateState.ready) updates?.apply(); else void updates?.check() }

  function resetBoard() {
    if (store.moves && !confirm('Start this puzzle over? Your level progress stays.')) return false
    store.replay()
    return true
  }

  function doHint() { store.hint() }

  const worldTheme = $derived(themeForWorld(store.world))
  const worldStart = $derived(store.world * WORLD_SIZE)
</script>

<!-- house version stamp: fixed top-right on every screen (the fleet pattern, matches
     quantamari's soft treatment). -->
<div class="version-stamp" aria-hidden="true">v{version}</div>

{#if store.storageMessage}
  <div class="storage-warning" role="status"><span>{store.storageMessage}</span><button onclick={() => openTransfer()}>SAVE TRANSFER</button></div>
{/if}

<!-- a deploy happened while this shell was open: one tap reloads into it -->
{#if updateState.ready}
  <button class="toast" onclick={() => updates?.apply()} disabled={updateState.status === 'applying'}>
    {updateState.status === 'applying' ? 'updating...' : updateState.status === 'unsaved' ? 'save unavailable, transfer your progress before updating' : 'update ready, tap to reload'}
  </button>
{/if}

{#if store.screen === 'levels'}
  <main class="screen" id="levels" tabindex="-1" aria-labelledby="levels-label">
    <header class="bar">
      <button class="chip" onclick={() => store.goGame()} aria-label="back to the game">&larr;</button>
      <span class="chip flat" id="levels-label">world {store.world + 1} &middot; {worldTheme.title}</span>
    </header>
    <div class="world-nav">
      <button class="chip" disabled={store.world === 0} onclick={() => store.setWorld(store.world - 1)}>&laquo; PREV</button>
      <span class="chip flat">{store.world + 1} / {WORLD_COUNT}</span>
      <button class="chip" disabled={store.world === WORLD_COUNT - 1} onclick={() => store.setWorld(store.world + 1)}>NEXT &raquo;</button>
    </div>
    <div id="world-grid" aria-label="levels in this world">
      {#each Array(WORLD_SIZE) as _, i}
        {@const n = worldStart + i + 1}
        {@const best = store.progress.done[n]}
        {@const earned = store.progress.stars[n]}
        <button
          class="lvl"
          class:done={best != null}
          class:now={n === store.progress.current}
          disabled={n > store.progress.current && best == null}
          aria-label={best != null ? `level ${n}, best ${best} moves, ${earned ?? 1} of 3 stars` : `level ${n}`}
          onclick={() => store.startLevel(n)}
        >
          <span>{n}</span>
          {#if best != null}<span class="sub">{earned ? '★'.repeat(earned) : `✓ ${best}`}</span>{/if}
        </button>
      {/each}
    </div>
    <p class="small center">
      {Object.keys(store.progress.done).length ? `you've sorted ${Object.keys(store.progress.done).length} of ${LEVEL_COUNT} levels` : 'sort a level to leave your mark!'}
    </p>
  </main>
  <!-- the house bottom bar, present on EVERY screen (kidgames#5). text only:
       plain words read faster than a generic icon and there is nothing to decode. -->
  <nav id="game-nav" aria-label="Main">
    <button onclick={() => store.goGame()}>PLAY</button>
    <button data-active onclick={() => store.openLevels()}>LEVELS</button>
    <button onclick={() => store.openDialog('looks')}>LOOKS</button>
    <button data-menu-opener onclick={() => store.openDialog('more')}>MORE</button>
  </nav>
{/if}

{#if store.screen === 'game'}
  <main class="screen" id="game" tabindex="-1" aria-labelledby="board-label">
    <header class="bar">
      <span class="chip flat" id="board-label">{store.boardLabel}</span>
      <span class="chip flat mono" aria-label="time elapsed">{store.clock}</span>
      <span class="chip flat mono" aria-live="polite">{store.moves} {store.moves === 1 ? 'move' : 'moves'}</span>
    </header>

    <!-- the first-run card: once, on the very first board, over nothing (the
         board is right there under it). the store never shows it again. -->
    {#if store.welcome}
      <div class="first-run" role="note">
        <p>tap a stack to pick up what's on top, then tap another stack to drop it there.</p>
        <button class="chip" onclick={() => store.dismissWelcome()}>GOT IT</button>
      </div>
    {/if}

    <Board {store} />

    <nav id="game-nav" aria-label="Game controls">
      <button onclick={() => store.openLevels()}>LEVELS</button>
      <button onclick={doHint}>HINT</button>
      <button onclick={() => store.undo()}>UNDO</button>
      <button onclick={resetBoard}>RESET</button>
      <button onclick={() => store.openDialog('looks')}>LOOKS</button>
      <button data-menu-opener onclick={() => store.openDialog('more')}>MORE</button>
    </nav>

    {#if store.stuck && !store.won}
      <div class="stuck">
        <p>no moves left!</p>
        <button class="chip" onclick={() => store.undo()}>UNDO</button>
        <button class="chip" onclick={resetBoard}>START OVER</button>
      </div>
    {/if}

    {#if store.won}
      <div class="won" role="status">
        <p class="won-title">SORTED!</p>
        <p class="won-stars" class:perfect={store.won.perfect} aria-label="{store.won.stars} of 3 stars earned">
          {'★'.repeat(store.won.stars)}{'☆'.repeat(3 - store.won.stars)}
        </p>
        <p class="won-detail">{store.won.detail}</p>
        {#if store.won.score}<p class="won-score">{store.won.score}</p>{/if}
        {#if store.won.canNext}<button class="big" onclick={() => store.nextLevel()}>NEXT LEVEL</button>{/if}
        <button class="big secondary" onclick={() => store.replay()}>PLAY AGAIN</button>
        <button class="big secondary" onclick={shareWin}>{winShareLabel}</button>
      </div>
    {/if}
  </main>
{/if}

<!-- ============ dialogs (real modal dialogs, see Modal.svelte) ============ -->
{#if store.dialog === 'more'}
  <Modal label="More" onclose={() => store.closeDialog()}>
    {#snippet children(close)}
      <h2>More</h2>
      <div class="more-list">
        <button class="big secondary" onclick={() => { if (resetBoard()) close() }}>START THIS ONE OVER</button>
        <button class="big secondary" onclick={() => { store.startDaily(); close() }}>TODAY'S PUZZLE</button>
        <button class="big secondary" onclick={() => store.openDialog('howto')}>HOW TO PLAY</button>
        <button class="big secondary sound-toggle" class:muted onclick={toggleSound} aria-pressed={!muted}>SOUND {muted ? 'OFF' : 'ON'}</button>
        <button class="big secondary" onclick={() => openTransfer()}>MOVE MY SAVE</button>
        {#if installable}<button class="big secondary" onclick={doInstall}>ADD TO HOME SCREEN</button>{/if}
        <button class="big secondary" onclick={() => store.openDialog('about')}>ABOUT</button>
      </div>
      <p class="ethos">no ads &middot; no timers &middot; nothing to buy &middot; no cookies</p>
      <button class="big" onclick={close}>BACK</button>
    {/snippet}
  </Modal>
{/if}

{#if store.dialog === 'transfer'}
  <Modal label="Move my save" onclose={() => closeTransfer(() => store.closeDialog())}>
    {#snippet children(close)}
      <h2>Move my save</h2>
      <p class="small">On this phone, use COPY SAVE CODE in the old shortcut. Open the new shortcut, come back here, paste it, and tap LOAD THIS SAVE.</p>
      <div class="transfer-actions">
        <button class="big" disabled={!saveCode} onclick={copySave}>COPY SAVE CODE</button>
        <button class="big secondary" disabled={!saveCode} onclick={showSaveQr}>SHOW AS QR CODE</button>
      </div>
      <canvas class="save-qr" bind:this={qrCanvas} hidden={!qrShown} aria-label="QR code containing a Sort It save link"></canvas>
      <textarea class="save-code" readonly bind:this={saveCodeEl} aria-label="Your save code">{saveCode}</textarea>
      <label class="save-label" for="save-import">Paste a save code here:</label>
      <textarea id="save-import" class="save-code" bind:value={saveImport} spellcheck="false" placeholder="si1..."></textarea>
      <button class="big" disabled={transferBusy} onclick={loadSave}>LOAD THIS SAVE</button>
      {#if rollbackReady}<button class="big secondary" disabled={transferBusy} onclick={useRollback}>UNDO LAST TRANSFER</button>{/if}
      <p class="transfer-status" role="status" aria-live="polite">{transferMsg}</p>
      <p class="small center">Nothing is uploaded. The QR carries the save inside the link.</p>
      <button class="big secondary" onclick={close}>BACK</button>
    {/snippet}
  </Modal>
{/if}

{#if store.dialog === 'howto'}
  <Modal label="How to play" onclose={() => store.closeDialog()}>
    {#snippet children(close)}
      <h2>How to play</h2>
      <ol>
        <li>Tap a stack to pick up what's on top.</li>
        <li>Tap another stack to drop it there.</li>
        <li>Drops only land on a <b>matching</b> friend, or on an empty spot.</li>
        <li>Fill a whole stack with one kind to finish it.</li>
        <li>Sort every stack to win!</li>
      </ol>
      <p class="small">Stuck? <b>UNDO</b> takes moves back as many times as you like, and <b>HINT</b> shows a good move. Some pieces hide as a <b>?</b>, move the piece on top to peek! Take as long as you want.</p>
      <button class="big" onclick={close}>GOT IT</button>
    {/snippet}
  </Modal>
{/if}

{#if store.dialog === 'looks'}
  <Modal label="Pick a look" onclose={() => store.closeDialog()}>
    {#snippet children(close)}
      <h2>Pick a look</h2>
      <div class="looks-grid">
        {#each store.skins as candidate}
          <button class="look" aria-pressed={candidate.key === store.skin.key} onclick={() => store.setSkin(candidate)}>
            <svg viewBox="0 0 64 64" aria-hidden="true">{@html candidate.preview}</svg>
            <span>{candidate.title}</span>
          </button>
        {/each}
      </div>
      <h2 class="looks-sub">Colours</h2>
      <div class="themes-row">
        {#each store.shellThemes as candidate}
          <button
            class="theme-chip"
            aria-pressed={candidate.key === store.shellTheme.key}
            onclick={() => store.setShellTheme(candidate)}
          >
            <span class="theme-swatch" aria-hidden="true">
              {#each candidate.swatch as colour}<i style:background={colour}></i>{/each}
            </span>
            <span>{candidate.title}</span>
          </button>
        {/each}
      </div>
      <p class="small">Same puzzles, totally different worlds. Your progress stays right where it is.</p>
      <button class="big" onclick={close}>DONE</button>
    {/snippet}
  </Modal>
{/if}

{#if store.dialog === 'about'}
  <Modal label="About Sort It" onclose={() => store.closeDialog()}>
    {#snippet children(close)}
      <h2>About Sort It</h2>
      <p class="about-body">tap a stack to pick up a piece, tap another to drop it, and sort every colour into its own stack. a fresh puzzle every day, hundreds of levels, and one to send a friend.</p>
      <p class="about-ethos">no ads, no lives, no timers, nothing to buy, no accounts, no cookies, nothing sold or shared. that is the whole point.</p>
      <p class="maker-mark">made with <svg aria-hidden="true" class="mark-heart" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><span class="sr">love</span> by
        <a href="https://royashbrook.com" target="_blank" rel="noreferrer">roy</a> +
        <a href="https://royashbrook.com/agents" target="_blank" rel="noreferrer">ai</a>
        <span aria-hidden="true" class="mark-dot">&middot;</span>
        <a href="https://github.com/sponsors/royashbrook" target="_blank" rel="noreferrer" class="mark-sponsor">sponsor me</a></p>
      <p class="small center">version {version}</p>
      <p class="small center">build {__RELEASE__.fingerprint.slice(0, 12)} · source {__RELEASE__.source.slice(0, 12)}</p>
      <p class="small center"><a href="./third-party-notices.txt" rel="license">licences</a></p>
      <button class="big secondary check-updates" class:ready={updateState.ready} disabled={updateState.status === 'applying'} onclick={checkUpdates}>
        {#if updateState.status === 'checking'}checking...{:else if updateState.status === 'unsaved'}save unavailable, use save transfer{:else if updateState.ready}update ready, tap to reload{:else if updateState.status === 'current'}up to date{:else if updateState.status === 'downloading'}downloading update...{:else if updateState.status === 'failed'}download failed, tap to retry{:else if updateState.status === 'offline'}offline, tap to retry{:else}check for updates{/if}
      </button>
      <button class="big" onclick={close}>BACK</button>
    {/snippet}
  </Modal>
{/if}

{#if store.dialog === 'ios-install'}
  <Modal label="Add to home screen" onclose={() => store.closeDialog()}>
    {#snippet children(close)}
      <h2>Add to home screen</h2>
      <ol>
        <li>Tap the <b>share</b> button at the bottom of Safari.</li>
        <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
        <li>Tap <b>Add</b>. It opens like a real app, and works with no internet.</li>
      </ol>
      <button class="big" onclick={close}>GOT IT</button>
    {/snippet}
  </Modal>
{/if}
