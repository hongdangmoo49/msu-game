import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsSource = readText('src/game/assets.ts');
const fallbackFixture = JSON.parse(readText('public/assets/manifest.fallback.json'));

assertIncludes(assetsSource, 'export async function loadManifestWithFallback()', 'fallback loader export missing');
assertIncludes(assetsSource, 'catch (error)', 'fallback loader must catch network errors');
assertIncludes(
  assetsSource,
  'manifest: createClientFallbackManifest(errorMessage(error))',
  'fallback loader must create client fallback on network error',
);
assertIncludes(assetsSource, "const MANIFEST_URL = '/api/manifest';", 'manifest endpoint must be local server route');

const tempDir = mkdtempSync(path.join(tmpdir(), 'msu-network-fallback-'));
const bundlePath = path.join(tempDir, 'assets.mjs');
const originalFetch = globalThis.fetch;

try {
  await build({
    entryPoints: [path.join(repoRoot, 'src', 'game', 'assets.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outfile: bundlePath,
    logLevel: 'silent',
  });

  const { loadManifestWithFallback } = await import(`${pathToFileURL(bundlePath).href}?${Date.now()}`);

  globalThis.fetch = async () => {
    throw new Error('network_blocked');
  };

  const result = await loadManifestWithFallback();
  assert(result.usedClientFallback === true, 'network block must use client fallback');
  assert(result.errorMessage === 'network_blocked', 'network block reason must be retained');
  assert(result.manifest.source === 'fallback', 'client fallback source expected');
  assert(Array.isArray(result.manifest.characters) && result.manifest.characters.length > 0, 'client fallback character required');
  assert(Array.isArray(result.manifest.skills) && result.manifest.skills.length > 0, 'client fallback skill required');
  assert(Array.isArray(result.manifest.icons) && result.manifest.icons.length > 0, 'client fallback icon required');
  for (const character of result.manifest.characters) {
    assertDataImage(character.image?.url, `client fallback character ${character.id} image must be inline`);
  }
  for (const skill of result.manifest.skills) {
    assertDataImage(skill.image?.url, `client fallback skill ${skill.id} image must be inline`);
  }
} finally {
  globalThis.fetch = originalFetch;
  rmSync(tempDir, { recursive: true, force: true });
}

assert(fallbackFixture.source === 'fallback', 'server fallback fixture source expected');
assert(Array.isArray(fallbackFixture.characters) && fallbackFixture.characters.length > 0, 'fallback character required');
assert(Array.isArray(fallbackFixture.skills) && fallbackFixture.skills.length > 0, 'fallback skill required');
assert(Array.isArray(fallbackFixture.icons) && fallbackFixture.icons.length > 0, 'fallback icon required');
assert(Array.isArray(fallbackFixture.rawResponses) && fallbackFixture.rawResponses.length > 0, 'fallback raw response required');

for (const character of fallbackFixture.characters) {
  assertDataImage(character.image?.url, `character ${character.id} image must be inline`);
}
for (const skill of fallbackFixture.skills) {
  assertDataImage(skill.image?.url, `skill ${skill.id} image must be inline`);
  assert(typeof skill.projectile?.textureKey === 'string', `skill ${skill.id} projectile texture key required`);
}
for (const icon of fallbackFixture.icons) {
  assertDataImage(icon.image?.url, `icon ${icon.id} image must be inline`);
}

console.log('network-fallback: passed');

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertIncludes(text, marker, message) {
  if (!text.includes(marker)) throw new Error(message);
}

function assertDataImage(value, message) {
  assert(typeof value === 'string' && value.startsWith('data:image/'), message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
