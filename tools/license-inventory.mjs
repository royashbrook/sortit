import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function packageForModule(id, cwd) {
  const clean = id.replace(/\?.*$/, '').replace(/^\0/, '')
  if (!clean.includes('/node_modules/')) return null
  let directory = dirname(clean)
  while (directory !== dirname(directory)) {
    const path = join(directory, 'package.json')
    if (existsSync(path)) {
      const pkg = JSON.parse(readFileSync(path, 'utf8'))
      if (pkg.name && pkg.version) {
        const notices = readdirSync(directory).filter(name => /^(licen[cs]e|copying|notice|third-party-license)([.-]|$)/i.test(name)).sort()
          .map(name => ({ path: relative(cwd, join(directory, name)), text: readFileSync(join(directory, name), 'utf8').trim() }))
        assert.ok(notices.some(notice => notice.text.length > 80), `missing license text for bundled ${pkg.name}`)
        return { name: pkg.name, version: pkg.version, license: pkg.license, notices }
      }
    }
    directory = dirname(directory)
  }
  throw new Error(`cannot identify bundled dependency: ${id}`)
}

export function inventoryForModules(ids, cwd = process.cwd()) {
  const packages = new Map()
  for (const id of [...new Set(ids)].sort()) {
    // These virtual modules are code shipped by the bundler, not build-only code.
    const helper = id.match(/^\0(vite|rolldown)\//)?.[1]
    const pkg = packageForModule(helper ? resolve(cwd, 'node_modules', helper, 'package.json') : id, cwd)
    if (!pkg) continue
    const key = `${pkg.name}@${pkg.version}`
    if (!packages.has(key)) packages.set(key, { ...pkg, modules: [] })
    packages.get(key).modules.push(helper ? id.replace(/^\0/, 'virtual:') : relative(cwd, id.replace(/^\0/, '').replace(/\?.*$/, '')))
  }
  const assets = []
  const scan = directory => {
    if (!existsSync(join(cwd, directory))) return
    for (const entry of readdirSync(join(cwd, directory), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) scan(path)
      else if (entry.isFile()) assets.push({ path, sha256: createHash('sha256').update(readFileSync(join(cwd, path))).digest('hex') })
    }
  }
  scan('static')
  return {
    schema: 1,
    scope: 'Package modules present in emitted browser chunks, plus static files copied to the artifact. Build-only dependencies are excluded. Bundler helpers retain their complete upstream notice files, which may describe more than the shipped helper. Authored art and synthesized audio remain repository code; ownership is documented in the release receipt.',
    packages: [...packages.values()].sort((a, b) => a.name < b.name ? -1 : 1),
    firstPartyModules: [...new Set(ids.filter(id => id.startsWith(resolve(cwd, 'src') + '/')))].sort()
      .map(id => ({ path: relative(cwd, id), sha256: createHash('sha256').update(readFileSync(id)).digest('hex') })),
    staticAssets: assets,
    generatedModules: [...new Set(ids.filter(id => id.startsWith('\0') && !id.includes('/node_modules/')))].sort(),
  }
}

export function noticeText(inventory) {
  return 'Sort It: bundled third-party notices\n\n' + inventory.scope + '\n\n'
    + inventory.packages.map(pkg => `${pkg.name} ${pkg.version} (${pkg.license})\n${pkg.notices.map(notice => `${notice.path}\n\n${notice.text}`).join('\n\n')}\n`).join('\n' + '='.repeat(72) + '\n\n')
}

export function licensePlugin(release) {
  let client = false
  return {
    name: 'sortit-release-notices',
    configResolved(config) { client = !config.build.ssr && /[/\\]output[/\\]client$/.test(config.build.outDir) },
    generateBundle(_options, bundle) {
      if (!client) return
      const ids = Object.values(bundle).flatMap(item => item.type === 'chunk'
        ? Object.entries(item.modules).filter(([, module]) => module.renderedLength > 0).map(([id]) => id) : [])
      const inventory = inventoryForModules(ids)
      for (const name of ['svelte', 'qrcode']) assert.ok(inventory.packages.some(pkg => pkg.name === name), `missing expected runtime ${name}`)
      for (const [fileName, source] of [
        ['licenses.json', JSON.stringify(inventory, null, 2) + '\n'],
        ['third-party-notices.txt', noticeText(inventory)],
        ['release.json', JSON.stringify(release, null, 2) + '\n'],
      ]) this.emitFile({ type: 'asset', fileName, source })
    },
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]) && process.argv[2] === '--test') {
  const ids = ['svelte/src/internal/client/index.js', 'qrcode/lib/browser.js', 'dijkstrajs/dijkstra.js', 'clsx/dist/clsx.mjs']
    .map(path => resolve('node_modules', path))
  const inventory = inventoryForModules([...ids, ids[0], resolve('src/routes/+page.svelte')])
  assert.deepEqual(inventory.packages.map(pkg => pkg.name), ['clsx', 'dijkstrajs', 'qrcode', 'svelte'])
  const text = noticeText(inventory)
  for (const pkg of inventory.packages) for (const notice of pkg.notices) assert.ok(text.includes(notice.text))
  assert.equal(inventory.packages.find(pkg => pkg.name === 'svelte').modules.length, 1)
  assert.equal(packageForModule('/app/src/main.ts', process.cwd()), null)
  console.log('license inventory: bundled modules, full installed notices and duplicate exclusion verified')
}
