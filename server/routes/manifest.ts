import { existsSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import fallbackManifestJson from '../../public/assets/manifest.fallback.json';
import {
  hasManifestReferences,
  isGameManifest,
  type ManifestImageRef,
  type MsuGameManifest,
  type MsuGameManifestSource
} from '../../src/msu/manifest';
import { normalizeMsuManifest } from '../../src/msu/normalize';
import { isProxyableResourceImageUrl, proxyResourceImageUrl } from './resourceImage';

export const manifestRoutePath = '/api/manifest';

interface ResolvedManifest {
  readonly manifest: MsuGameManifest;
  readonly source: MsuGameManifestSource;
}

const json = (data: unknown): string => JSON.stringify(data);

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const isReadableFile = (filePath: string): boolean => {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const readJsonFile = (filePath: string): unknown => JSON.parse(readFileSync(filePath, 'utf8'));

const ensureUsableManifest = (
  value: unknown,
  source: MsuGameManifestSource,
  revision: string
): MsuGameManifest => {
  if (isGameManifest(value)) {
    if (!hasManifestReferences(value)) {
      throw new Error('manifest_has_no_game_references');
    }

    return value;
  }

  const normalized = normalizeMsuManifest(value, { source, revision });

  if (!hasManifestReferences(normalized)) {
    throw new Error('normalized_manifest_has_no_game_references');
  }

  return normalized;
};

const isFailureEnvelope = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  (value as { readonly success?: unknown }).success === false;

const loadProxyManifest = async (): Promise<MsuGameManifest | null> => {
  const proxyUrl = process.env.MSU_MANIFEST_PROXY_URL;

  if (proxyUrl === undefined || proxyUrl.trim() === '') {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    parsePositiveInt(process.env.MSU_MANIFEST_PROXY_TIMEOUT_MS, 2500)
  );

  try {
    const response = await fetch(proxyUrl, {
      headers: { accept: 'application/json' },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`proxy_status_${response.status}`);
    }

    const body: unknown = await response.json();

    if (isFailureEnvelope(body)) {
      throw new Error('proxy_success_false');
    }

    return ensureUsableManifest(body, 'msu-proxy', 'proxy');
  } finally {
    clearTimeout(timeout);
  }
};

const loadFileManifest = (filePath: string, revision: string): MsuGameManifest | null => {
  if (!isReadableFile(filePath)) {
    return null;
  }

  const body = readJsonFile(filePath);

  if (isFailureEnvelope(body)) {
    throw new Error(`${revision}_success_false`);
  }

  return ensureUsableManifest(body, 'msu-cache', revision);
};

const loadCacheManifest = (): MsuGameManifest | null => {
  const configuredPath = process.env.MSU_MANIFEST_PATH ?? process.env.MSU_MANIFEST_CACHE_PATH;
  const cachePath =
    configuredPath === undefined || configuredPath.trim() === ''
      ? path.resolve('public/assets/manifest.cache.json')
      : path.resolve(configuredPath);

  return loadFileManifest(cachePath, 'cache');
};

const loadRawManifest = (): MsuGameManifest | null => {
  const rawPath = process.env.MSU_MANIFEST_RAW_PATH;

  if (rawPath === undefined || rawPath.trim() === '') {
    return null;
  }

  return loadFileManifest(path.resolve(rawPath), 'raw');
};

const fallbackManifest = (): MsuGameManifest =>
  ensureUsableManifest(fallbackManifestJson, 'fallback', 'fallback');

const proxyImageRef = (image: ManifestImageRef): ManifestImageRef => {
  if (image.url === null || !isProxyableResourceImageUrl(image.url)) {
    return image;
  }

  return {
    ...image,
    url: proxyResourceImageUrl(image.url),
    kind: 'local'
  };
};

const withLocalResourceImageProxy = (manifest: MsuGameManifest): MsuGameManifest => ({
  ...manifest,
  characters: manifest.characters.map((character) => ({
    ...character,
    image: proxyImageRef(character.image)
  })),
  skills: manifest.skills.map((skill) => ({
    ...skill,
    image: proxyImageRef(skill.image)
  })),
  items: manifest.items.map((item) => ({
    ...item,
    image: proxyImageRef(item.image)
  })),
  icons: manifest.icons.map((icon) => ({
    ...icon,
    image: proxyImageRef(icon.image)
  })),
  enemies: manifest.enemies?.map((enemy) => ({
    ...enemy,
    image: proxyImageRef(enemy.image)
  })),
  backgrounds: manifest.backgrounds?.map((background) => ({
    ...background,
    image: proxyImageRef(background.image)
  })),
});

const resolveManifest = async (): Promise<ResolvedManifest> => {
  try {
    const proxyManifest = await loadProxyManifest();

    if (proxyManifest !== null) {
      return { manifest: proxyManifest, source: 'msu-proxy' };
    }
  } catch (error) {
    logManifestFallback('manifest_proxy_failed', error);
  }

  try {
    const rawManifest = loadRawManifest();

    if (rawManifest !== null) {
      return { manifest: rawManifest, source: 'msu-cache' };
    }
  } catch (error) {
    logManifestFallback('manifest_raw_failed', error);
  }

  try {
    const cacheManifest = loadCacheManifest();

    if (cacheManifest !== null) {
      return { manifest: cacheManifest, source: 'msu-cache' };
    }
  } catch (error) {
    logManifestFallback('manifest_cache_failed', error);
  }

  return { manifest: fallbackManifest(), source: 'fallback' };
};

const logManifestFallback = (event: string, error: unknown): void => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      message: error instanceof Error ? error.message : 'Unknown manifest load error'
    })
  );
};

export const isManifestRoute = (pathname: string): boolean => pathname === manifestRoutePath;

export const handleManifestRoute = async (
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> => {
  const method = request.method ?? 'GET';

  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, {
      allow: 'GET, HEAD',
      'content-type': 'application/json; charset=utf-8'
    });
    response.end(json({ error: 'method_not_allowed' }));
    return;
  }

  const resolved = await resolveManifest();
  const manifest = withLocalResourceImageProxy(resolved.manifest);

  response.writeHead(200, {
    'cache-control': resolved.source === 'fallback' ? 'no-store' : 'public, max-age=60',
    'content-type': 'application/json; charset=utf-8',
    'x-msu-manifest-source': resolved.source,
    'x-msu-manifest-fallback': String(resolved.source === 'fallback')
  });
  response.end(method === 'HEAD' ? undefined : json(manifest));
};
