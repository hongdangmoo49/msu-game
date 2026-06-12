import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const forbiddenClientBundleMarkers = [
  'MSU_API_KEY',
  'VITE_MSU_API_KEY',
  'NXOPEN_API_KEY',
  'x-nxopen-api-key',
  'msu-authorization',
  'openapi.msu.io',
];

const forbiddenInGameMarkers = [
  'fetch(',
  'XMLHttpRequest',
  'navigator.sendBeacon',
  '/api/msu',
  'openapi.msu.io',
  'x-nxopen-api-key',
  'msu-authorization',
];

const clientBundleDir = path.join(repoRoot, 'dist', 'client');
if (existsSync(clientBundleDir)) {
  assertNoMarkers(listFiles(clientBundleDir), forbiddenClientBundleMarkers, 'client bundle');
} else {
  console.warn('security-static: dist/client missing; run npm run build before bundle scan');
}

const gameRuntimeFiles = [
  path.join(repoRoot, 'src', 'game', 'scenes', 'GameScene.ts'),
  ...listFiles(path.join(repoRoot, 'src', 'game', 'entities')),
  ...listFiles(path.join(repoRoot, 'src', 'game', 'systems')),
  ...listFiles(path.join(repoRoot, 'src', 'game', 'ui')),
];
assertNoMarkers(gameRuntimeFiles, forbiddenInGameMarkers, 'in-game runtime');

const assetsSource = readText(path.join(repoRoot, 'src', 'game', 'assets.ts'));
assertIncludes(assetsSource, "const MANIFEST_URL = '/api/manifest';", 'manifest fetch is server cache endpoint');
assertNotIncludes(assetsSource, '/api/msu', 'assets.ts must not proxy MSU endpoints directly');
assertNotIncludes(assetsSource, 'openapi.msu.io', 'assets.ts must not call MSU upstream directly');
assertNotIncludes(assetsSource, 'x-nxopen-api-key', 'assets.ts must not include API key header');
assertNotIncludes(assetsSource, 'msu-authorization', 'assets.ts must not include auth header');

const sentinel = process.env.MSU_API_KEY;
if (sentinel) {
  assertNoMarkers(listFiles(clientBundleDir), [sentinel], 'client bundle API key value');
}

console.log('security-static: passed');

function listFiles(dir) {
  if (!existsSync(dir)) return [];

  const entries = readdirSync(dir).flatMap((name) => {
    const fullPath = path.join(dir, name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listFiles(fullPath);
    return [fullPath];
  });

  return entries.filter((file) => /\.(css|html|js|json|map|ts)$/.test(file));
}

function assertNoMarkers(files, markers, scope) {
  for (const file of files) {
    const text = readText(file);
    for (const marker of markers) {
      assertNotIncludes(text, marker, `${scope}: ${relative(file)} contains ${marker}`);
    }
  }
}

function readText(file) {
  return readFileSync(file, 'utf8');
}

function assertIncludes(text, marker, message) {
  if (!text.includes(marker)) throw new Error(message);
}

function assertNotIncludes(text, marker, message) {
  if (marker !== '' && text.includes(marker)) throw new Error(message);
}

function relative(file) {
  return path.relative(repoRoot, file);
}
