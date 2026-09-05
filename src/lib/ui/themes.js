// the SHELL theme layer: the house standard's skinnable rule.
//
//   structure is shared and fixed, look and feel is a swappable layer.
//   mechanism: kidgames docs/shell-theme-tokens.md
//
// this is NOT the game-art skin layer (skins.js: tubes vs bolts vs blocks, the
// CONTAINER and the MOTION verb). the two are orthogonal on purpose: a theme repaints
// the chrome and the board surround, a skin changes what the pieces ARE. you can run
// any skin under any theme.
//
// a theme is nothing but token VALUES. no structure, no class names, no markup. that
// is what makes it swappable, and what the theme-swap proof checks.

const KEY = 'sortit:theme'

export const THEME_TOKENS = [
  '--surface', '--surface-raised', '--surface-sunk',
  '--ink', '--ink-dim', '--ink-on-accent',
  '--accent', '--accent-dim', '--line',
  '--font-mono', '--shadow-pressed', '--mark-heart',
]

// the tokens no theme repaints: the type, the pressed shadow's geometry, and
// the maker mark's heart (the signature on the work, the same in every theme)
const FIXED = {
  '--font-mono': 'ui-monospace, monospace',
  '--shadow-pressed': '0 .05rem 0 var(--line)',
  '--mark-heart': '#e0746a',
}

export const SHELL_THEMES = [
  {
    key: 'daylight',
    title: 'Daylight',
    swatch: ['#FFF6E5', '#FFB03A', '#3D3230'],
    tokens: {
      '--surface': '#FFF6E5',
      '--surface-raised': '#FFFFFF',
      '--surface-sunk': '#FFEED2',
      '--ink': '#3D3230',
      '--ink-dim': '#8A7A70',
      '--ink-on-accent': '#3D3230',
      '--accent': '#FFB03A',
      '--accent-dim': '#E89B27',
      '--line': '#3D3230',
      ...FIXED,
    },
  },
  {
    key: 'dusk',
    title: 'Dusk',
    swatch: ['#241F2E', '#FFB03A', '#F2ECE2'],
    tokens: {
      '--surface': '#241F2E',
      '--surface-raised': '#332B42',
      '--surface-sunk': '#1B1724',
      '--ink': '#F2ECE2',
      '--ink-dim': '#B3A8BF',
      '--ink-on-accent': '#241F2E',
      '--accent': '#FFB03A',
      '--accent-dim': '#D8912A',
      '--line': '#F2ECE2',
      ...FIXED,
    },
  },
  {
    key: 'bubblegum',
    title: 'Bubblegum',
    swatch: ['#FFF0F6', '#FF74A8', '#4A2740'],
    tokens: {
      '--surface': '#FFF0F6',
      '--surface-raised': '#FFFFFF',
      '--surface-sunk': '#FFE0EC',
      '--ink': '#4A2740',
      '--ink-dim': '#96718A',
      '--ink-on-accent': '#FFFFFF',
      '--accent': '#FF74A8',
      '--accent-dim': '#E85C90',
      '--line': '#4A2740',
      ...FIXED,
    },
  },
]

export function themeByKey(key) {
  return SHELL_THEMES.find(t => t.key === key) ?? SHELL_THEMES[0]
}

export function loadTheme() {
  try { return themeByKey(localStorage.getItem(KEY)) } catch { return SHELL_THEMES[0] }
}

export function saveTheme(key) {
  try { localStorage.setItem(KEY, key) } catch { /* private mode: the look just resets */ }
}

// paint by writing the token VALUES onto the root. nothing else moves: same DOM, same
// class names, same structure, which is exactly the compliance bar.
export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [token, value] of Object.entries(theme.tokens)) root.style.setProperty(token, value)
  root.dataset.theme = theme.key
}
