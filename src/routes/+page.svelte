<script>
  import { onMount } from 'svelte'
  import { createStore, LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT } from '$lib/ui/store.svelte.js'
  import { themeForWorld } from '$lib/engine/art/index.js'
  import { dailySeed } from '$lib/engine/seed.js'
  import { updated } from '$app/state'
  import { sound } from '$lib/ui/sounds.js'
  import Board from '$lib/ui/Board.svelte'
  import Modal from '$lib/ui/Modal.svelte'

  const store = createStore()
  const version = __APP_VERSION__

  let muted = $state(sound.muted)
  let installEvent = $state(null)
  let installable = $state(false)
  let iosInstall = $state(false)
  let updateState = $state('')

  // a shared link drops the player onto their friend's exact board
  onMount(() => {
    const params = new URLSearchParams(location.search)
    const lvl = Number.parseInt(params.get('level') ?? '', 10)
    const seed = Number.parseInt(params.get('seed') ?? '', 10)
    if (Number.isFinite(lvl) && lvl >= 1 && lvl <= LEVEL_COUNT) store.startLevel(lvl)
    else if (Number.isFinite(seed) && seed > 0) store.startSeed(seed)

    // install helper (shell): hidden until genuinely installable; ios gets a hint
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isInstalled = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    if (isIos && !isInstalled) { iosInstall = true; installable = true }
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; installable = true })
    addEventListener('appinstalled', () => { installable = false })

    // two tabs sharing one store: adopt the better progress rather than clobber
    addEventListener('storage', e => { if (e.key === 'sortit:progress') store.mergeExternalProgress() })
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

  let friendLabel = $state('PLAY WITH A FRIEND')
  async function shareFriend() {
    const r = await share(store.screen === 'game' ? store.board : { kind: 'seed', seed: dailySeed() })
    if (r === 'copied') { friendLabel = 'LINK COPIED, SEND IT'; setTimeout(() => friendLabel = 'PLAY WITH A FRIEND', 2400) }
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

  // update check: compare the served shell against the booted one, so a stale
  // installed client can pull the current deploy (kit worker is passive)
  // kit's own version check: `updated.current` is true when the DEPLOYED version
  // differs from the one THIS build booted with (the version is baked into the
  // running bundle, so there is no stale-baseline trap). updated.check() forces it.
  async function checkUpdates() {
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
     quantamari's soft treatment). the .version-stamp css was already here; nothing wired it. -->
<div class="version-stamp" aria-hidden="true">v{version}</div>

{#if store.screen === 'menu'}
  <main class="screen" id="menu">
    <h1>Sort It</h1>
    <p class="tagline">sort everything into tidy tubes</p>
    <button class="big" onclick={() => store.startLevel(store.progress.current)}>PLAY</button>
    <button class="big secondary" onclick={() => store.startDaily()}>TODAY'S PUZZLE</button>
    <button class="big secondary" onclick={() => store.openLevels()}>PICK A LEVEL</button>
    <button class="big secondary" onclick={shareFriend}>{friendLabel}</button>
    <button class="big secondary" onclick={() => store.openDialog('howto')}>HOW TO PLAY</button>
    <button class="big secondary" onclick={() => store.openDialog('looks')}>LOOKS</button>
    <button class="big secondary sound-toggle" class:muted onclick={toggleSound} aria-pressed={!muted}>&#9834; SOUND{muted ? ' (off)' : ''}</button>
    {#if installable}<button class="big secondary" onclick={doInstall}>ADD TO HOME SCREEN</button>{/if}
    <button class="big secondary" onclick={() => store.openDialog('about')}>ABOUT</button>
    <p class="ethos">no ads &middot; no timers &middot; nothing to buy &middot; no cookies</p>
  </main>
  <!-- the house bottom bar, present on EVERY screen. same styling and placement
       throughout; the CONTENTS are genre-appropriate (kidgames#5): tabs while you are
       choosing, in-play controls while you are solving. a launch screen with no bar at
       all is what this closes. -->
  <nav id="game-nav" aria-label="Main">
    <button onclick={() => store.startLevel(store.progress.current)} aria-label="Play"><span aria-hidden="true">&#9654;</span><b>PLAY</b></button>
    <button onclick={() => store.openLevels()} data-active={store.screen === 'levels' ? '' : undefined} aria-label="Pick a level"><span aria-hidden="true">&#9776;</span><b>LEVELS</b></button>
    <button onclick={() => store.openDialog('looks')} aria-label="Looks"><span aria-hidden="true">&#10024;</span><b>LOOKS</b></button>
    <button onclick={() => store.openDialog('about')} aria-label="More"><span aria-hidden="true">&#9881;</span><b>MORE</b></button>
  </nav>

{/if}

{#if store.screen === 'levels'}
  <main class="screen" id="levels">
    <header class="bar">
      <button class="chip" onclick={() => store.goMenu()} aria-label="back to menu">&larr;</button>
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
  <!-- the house bottom bar, present on EVERY screen. same styling and placement
       throughout; the CONTENTS are genre-appropriate (kidgames#5): tabs while you are
       choosing, in-play controls while you are solving. a launch screen with no bar at
       all is what this closes. -->
  <nav id="game-nav" aria-label="Main">
    <button onclick={() => store.startLevel(store.progress.current)} aria-label="Play"><span aria-hidden="true">&#9654;</span><b>PLAY</b></button>
    <button onclick={() => store.openLevels()} data-active={store.screen === 'levels' ? '' : undefined} aria-label="Pick a level"><span aria-hidden="true">&#9776;</span><b>LEVELS</b></button>
    <button onclick={() => store.openDialog('looks')} aria-label="Looks"><span aria-hidden="true">&#10024;</span><b>LOOKS</b></button>
    <button onclick={() => store.openDialog('about')} aria-label="More"><span aria-hidden="true">&#9881;</span><b>MORE</b></button>
  </nav>

{/if}

{#if store.screen === 'game'}
  <main class="screen" id="game">
    <header class="bar">
      <span class="chip flat" id="board-label">{store.boardLabel}</span>
      <span class="chip flat mono" aria-label="time elapsed">{store.clock}</span>
      <span class="chip flat mono" aria-live="polite">{store.moves} {store.moves === 1 ? 'move' : 'moves'}</span>
    </header>

    <Board {store} />

    <nav id="game-nav" aria-label="Game controls">
      <button onclick={() => store.goMenu()} aria-label="Back to menu"><span aria-hidden="true">&#9776;</span><b>MENU</b></button>
      <button onclick={doHint}><span aria-hidden="true">&#10024;</span><b>HINT</b></button>
      <button onclick={() => store.undo()}><span aria-hidden="true">&#8630;</span><b>UNDO</b></button>
      <button onclick={() => store.replay()}><span aria-hidden="true">&#8635;</span><b>RESET</b></button>
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
{#if store.dialog === 'howto'}
  <Modal label="How to play" onclose={() => store.closeDialog()}>
    {#snippet children(close)}
      <h2>How to play</h2>
      <ol>
        <li>Tap a tube to pick up what's on top.</li>
        <li>Tap another tube to drop it there.</li>
        <li>Drops only land on a <b>matching</b> friend, or in an empty tube.</li>
        <li>Fill a whole tube with one kind to finish it.</li>
        <li>Sort every tube to win!</li>
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
      <p class="small">Same puzzles, different costume. Changing it never touches your game.</p>
      <button class="big" onclick={close}>DONE</button>
    {/snippet}
  </Modal>
{/if}

{#if store.dialog === 'about'}
  <Modal label="About Sort It" onclose={() => store.closeDialog()}>
    {#snippet children(close)}
      <h2>About Sort It</h2>
      <p class="about-body">tap a tube to pick up a piece, tap another to drop it, and sort every colour into its own tube. a fresh puzzle every day, hundreds of levels, and one to send a friend.</p>
      <p class="about-ethos">no ads, no lives, no timers, nothing to buy, no accounts, no cookies, nothing sold or shared. that is the whole point.</p>
      <p class="maker-mark">made with <svg aria-hidden="true" class="mark-heart" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><span class="sr">love</span> by
        <a href="https://royashbrook.com" target="_blank" rel="noreferrer">roy</a> +
        <a href="https://royashbrook.com/agents" target="_blank" rel="noreferrer">ai</a>
        <span aria-hidden="true" class="mark-dot">&middot;</span>
        <a href="https://github.com/sponsors/royashbrook" target="_blank" rel="noreferrer" class="mark-sponsor">sponsor me</a></p>
      <button class="big secondary check-updates" onclick={checkUpdates}>
        {#if updateState === 'checking'}checking...{:else if updateState === 'current'}up to date{:else if updateState === 'stale'}update ready, tap to reload{:else if updateState === 'offline'}offline{:else}check for updates{/if}
      </button>
      {#if updateState === 'stale'}<button class="big" onclick={() => location.reload()}>RELOAD NOW</button>{/if}
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
