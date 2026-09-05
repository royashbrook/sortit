<script>
  import { onMount } from 'svelte'
  import { createStore, LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT } from '$lib/ui/store.svelte.js'
  import { themeForWorld } from '$lib/engine/art/index.js'
  import { dailySeed } from '$lib/engine/seed.js'
  import { updated } from '$app/state'
  import { sound } from '$lib/ui/sounds.js'
  import QRCode from 'qrcode'
  import {
    codeFromHash,
    encodeSave,
    hasRollback,
    importSave,
    restoreRollback,
    saveLink,
  } from '$lib/ui/save-transfer.js'
  import Board from '$lib/ui/Board.svelte'
  import Modal from '$lib/ui/Modal.svelte'

  const store = createStore()
  const version = __APP_VERSION__

  let muted = $state(sound.muted)
  let installEvent = $state(null)
  let installable = $state(false)
  let iosInstall = $state(false)
  let updateState = $state('')
  let saveCode = $state('')
  let saveImport = $state('')
  let transferMsg = $state('')
  let qrShown = $state(false)
  let rollbackReady = $state(false)
  let saveCodeEl = $state()
  let qrCanvas = $state()

  // a shared link drops the player onto their friend's exact board
  onMount(() => {
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
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; installable = true })
    addEventListener('appinstalled', () => { installable = false })

    // two tabs sharing one store: adopt the better progress rather than clobber
    addEventListener('storage', e => { if (e.key === 'sortit:progress') store.mergeExternalProgress() })

    // kit polls the deployed version on its own interval; coming back to the
    // app is the moment a player would want to know, so ask right then too
    const onVisibility = () => {
      store.setVisible(!document.hidden)
      if (!document.hidden) updated.check().catch(() => {})
    }
    const onPageHide = () => store.setVisible(false)
    const onPageShow = () => store.setVisible(true)
    document.addEventListener('visibilitychange', onVisibility)
    addEventListener('pagehide', onPageHide)
    addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      removeEventListener('pagehide', onPageHide)
      removeEventListener('pageshow', onPageShow)
    }
  })

  function toggleSound() { muted = sound.toggle() }

  async function share(subject) {
    const url = new URL(location.href)
    url.search = ''
    if (subject?.kind === 'level') url.searchParams.set('level', String(subject.n))
    else url.searchParams.set('seed', String(subject?.seed ?? dailySeed()))
    const payload = { title: 'Sort It', text: 'play this exact Sort It puzzle with me', url: url.toString() }
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) { await navigator.share(payload); return 'shared' }
    } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
    try { await navigator.clipboard.writeText(url.toString()); return 'copied' } catch { return 'failed' }
  }

  let winShareLabel = $state('SEND THIS PUZZLE TO A FRIEND')
  async function shareWin() {
    const r = await share(store.board)
    if (r === 'copied') { winShareLabel = 'LINK COPIED, SEND IT'; setTimeout(() => winShareLabel = 'SEND THIS PUZZLE TO A FRIEND', 2400) }
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

  async function openTransfer(incoming = '') {
    store.openDialog('transfer')
    saveImport = incoming
    qrShown = false
    rollbackReady = hasRollback()
    transferMsg = 'building your save code...'
    try {
      saveCode = await encodeSave()
      transferMsg = incoming ? 'a save arrived. tap LOAD THIS SAVE to use it.' : 'ready to move.'
    } catch (error) {
      saveCode = ''
      transferMsg = error?.message ?? 'your save could not be read.'
    }
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
    transferMsg = 'building the QR code...'
    try {
      await QRCode.toCanvas(qrCanvas, saveLink(saveCode), { errorCorrectionLevel: 'L', margin: 2, width: 260 })
      qrShown = true
      transferMsg = 'scan this with the other device.'
    } catch {
      qrShown = false
      transferMsg = 'this save is too big for a QR code. use COPY SAVE CODE.'
    }
  }

  async function loadSave() {
    if (!saveImport.trim()) { transferMsg = 'paste a save code first.'; return }
    if (!confirm('Replace this shortcut\'s progress? Its current save will be kept as a one-step rollback.')) return
    try {
      await importSave(saveImport)
      transferMsg = 'progress moved. restarting...'
      clearSaveLink()
      setTimeout(() => location.reload(), 500)
    } catch (error) {
      transferMsg = error?.message ?? 'that save code did not work.'
    }
  }

  function clearSaveLink() {
    if (codeFromHash(location.hash)) location.replace(location.pathname + location.search)
  }

  function closeTransfer(close) {
    close()
    clearSaveLink()
  }

  function useRollback() {
    if (!confirm('Put back the save from before the last transfer?')) return
    try {
      restoreRollback()
      transferMsg = 'old save restored. restarting...'
      setTimeout(() => location.reload(), 500)
    } catch (error) {
      transferMsg = error?.message ?? 'the rollback could not be restored.'
    }
  }

  // kit's own version check: `updated.current` is true when the DEPLOYED version
  // differs from the one THIS build booted with (the version is baked into the
  // running bundle, so there is no stale-baseline trap). updated.check() forces it.
  async function checkUpdates() {
    if (updateState === 'stale') { location.reload(); return } // the button IS the reload once an update is ready
    updateState = 'checking'
    try {
      const stale = await updated.check()
      updateState = stale || updated.current ? 'stale' : 'current'
    } catch { updateState = 'offline' }
    if (updateState !== 'stale') setTimeout(() => updateState = '', 2500)
  }

  function doHint() { store.hint() }

  const worldTheme = $derived(themeForWorld(store.world))
  const worldStart = $derived(store.world * WORLD_SIZE)
</script>

<!-- house version stamp: fixed top-right on every screen (the fleet pattern, matches
     quantamari's soft treatment). -->
<div class="version-stamp" aria-hidden="true">v{version}</div>

<!-- a deploy happened while this shell was open: one tap reloads into it -->
{#if updated.current}
  <button class="toast" onclick={() => location.reload()}>update ready, tap to reload</button>
{/if}

{#if store.screen === 'levels'}
  <main class="screen" id="levels">
    <header class="bar">
      <button class="chip" onclick={() => store.goGame()} aria-label="back to the game">&larr;</button>
      <span class="chip flat">world {store.world + 1} &middot; {worldTheme.title}</span>
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
    <button onclick={() => store.openDialog('more')}>MORE</button>
  </nav>
{/if}

{#if store.screen === 'game'}
  <main class="screen" id="game">
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
      <button onclick={() => store.replay()}>RESET</button>
      <button onclick={() => store.openDialog('looks')}>LOOKS</button>
      <button onclick={() => store.openDialog('more')}>MORE</button>
    </nav>

    {#if store.stuck && !store.won}
      <div class="stuck">
        <p>no moves left!</p>
        <button class="chip" onclick={() => store.undo()}>UNDO</button>
        <button class="chip" onclick={() => store.replay()}>START OVER</button>
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
        <button class="big secondary" onclick={() => { store.replay(); close() }}>START THIS ONE OVER</button>
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
      <button class="big" onclick={loadSave}>LOAD THIS SAVE</button>
      {#if rollbackReady}<button class="big secondary" onclick={useRollback}>UNDO LAST TRANSFER</button>{/if}
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
      <button class="big secondary check-updates" class:ready={updateState === 'stale'} onclick={checkUpdates}>
        {#if updateState === 'checking'}checking...{:else if updateState === 'current'}up to date{:else if updateState === 'stale'}update ready, tap to reload{:else if updateState === 'offline'}offline{:else}check for updates{/if}
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
