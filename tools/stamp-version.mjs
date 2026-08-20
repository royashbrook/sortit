// Writes version.js with the house version string, the same convention craftrush uses:
// the latest git tag as major.minor, and the commit count since it as the patch. So a
// `v0.1` tag plus 5 commits reads `0.1.5`, proper semver that bumps itself every deploy.
// Falls back to package.json when git or a tag is missing (a fresh clone, a shallow CI
// checkout with no tags), so a build never fails over the version stamp.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

function version() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const since = execSync(`git rev-list ${tag}..HEAD --count`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return `${tag.replace(/^v/, '')}.${since}`;
  } catch {
    try { return JSON.parse(readFileSync('package.json', 'utf8')).version || '0.0.0'; }
    catch { return '0.0.0'; }
  }
}

const v = version();
// A plain global, not a module: a missing version.js then degrades to the 'dev' fallback
// in app.js instead of throwing an import error.
writeFileSync('version.js', `window.__APP_VERSION = ${JSON.stringify(v)};\n`);
console.log(`stamped version.js: ${v}`);
