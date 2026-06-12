/**
 * Asset loading pipeline: fetch manifest → queue images → fallback textures.
 * All network is server-proxied (/api/manifest); no MSU keys reach the browser.
 */
import { isGameManifest, MSU_GAME_MANIFEST_SCHEMA_VERSION } from '../msu/manifest';
import type {
  MsuGameManifest,
  MsuGameCharacter,
} from '../msu/manifest';

/* ---------- constants ---------- */

const FALLBACK_COLORS = {
  character: 0x3b82f6,
  skill: 0xa78bfa,
  item: 0xf59e0b,
  icon: 0x22c55e,
} as const;

const MANIFEST_URL = '/api/manifest';

export const GAME_ASSET_REGISTRY_KEYS = {
  manifest: 'msu.manifest',
  loadState: 'msu.loadState',
} as const;

export const CORE_TEXTURE_KEYS = {
  player: 'player',
  enemy: 'enemy',
  projectile: 'projectile',
  xpOrb: 'xp_orb',
  fallbackCharacter: 'fallback_character',
  fallbackSkill: 'fallback_skill',
  fallbackItem: 'fallback_item',
  fallbackIcon: 'fallback_icon',
} as const;

/* ---------- public types ---------- */

export interface EntityImageEntry {
  readonly id: string;
  readonly kind: keyof typeof FALLBACK_COLORS;
  readonly name: string;
  readonly sourceId?: string;
}

export interface QueueResult {
  readonly keys: readonly string[];
  readonly queuedKeys: readonly string[];
  readonly fallbackKeys: readonly string[];
  readonly entityMap: ReadonlyMap<string, EntityImageEntry>;
}

export interface ManifestLoadResult {
  readonly manifest: MsuGameManifest;
  readonly usedClientFallback: boolean;
  readonly errorMessage: string | null;
}

export interface ManifestLoadState {
  readonly source: MsuGameManifest['source'];
  readonly usedClientFallback: boolean;
  readonly errorMessage: string | null;
  readonly imageFailures: readonly string[];
  readonly warnings: readonly string[];
}

export interface MatchStartData {
  readonly manifest: MsuGameManifest;
  readonly selectedCharacter: MsuGameCharacter;
  readonly loadState: ManifestLoadState;
}

/* ---------- manifest fetch ---------- */

export async function fetchManifest(): Promise<MsuGameManifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) throw new Error(`manifest_fetch_${response.status}`);
  const data: unknown = await response.json();
  if (!isGameManifest(data)) throw new Error('manifest_invalid_schema');
  return data;
}

export async function loadManifestWithFallback(): Promise<ManifestLoadResult> {
  try {
    return {
      manifest: await fetchManifest(),
      usedClientFallback: false,
      errorMessage: null,
    };
  } catch (error) {
    return {
      manifest: createClientFallbackManifest(errorMessage(error)),
      usedClientFallback: true,
      errorMessage: errorMessage(error),
    };
  }
}

export function createEmptyManifest(): MsuGameManifest {
  return createClientFallbackManifest('manifest_empty_fallback');
}

export function createClientFallbackManifest(reason: string): MsuGameManifest {
  const characterImage = svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill="#0f172a"/>
      <circle cx="32" cy="23" r="12" fill="#38bdf8"/>
      <path d="M15 57c4-13 12-20 17-20s13 7 17 20" fill="#f8fafc"/>
    </svg>
  `);
  const skillImage = svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="10" fill="#1e293b"/>
      <path d="M39 4 14 37h17l-5 23 24-34H33z" fill="#facc15"/>
    </svg>
  `);

  return {
    schemaVersion: MSU_GAME_MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: 'fallback',
    characters: [
      {
        id: 'client-fallback-hero',
        kind: 'character',
        assetKey: 'client-fallback-hero',
        name: 'Fallback Hero',
        job: 'Explorer',
        level: 200,
        image: {
          url: characterImage,
          sourceField: 'clientFallbackDataUrl',
          kind: 'inline',
          isValidUrl: true,
          validationStatus: 'valid',
        },
        raw: {
          source: 'client-fallback',
          reason,
        },
      },
    ],
    skills: [
      {
        id: 'client-fallback-skill',
        kind: 'skill',
        skillId: 'client-fallback-skill',
        name: 'Arcane Bolt',
        description: 'Client fallback projectile.',
        level: 30,
        image: {
          url: skillImage,
          sourceField: 'clientFallbackDataUrl',
          kind: 'inline',
          isValidUrl: true,
          validationStatus: 'valid',
        },
        projectile: {
          textureKey: 'client-fallback-skill-icon',
          tint: '#facc15',
          speed: 540,
          fireRateMs: 360,
          damage: 14,
        },
        raw: {
          source: 'client-fallback',
          reason,
        },
      },
    ],
    items: [],
    icons: [
      {
        id: 'client-fallback-skill-icon',
        label: 'Arcane Bolt',
        entityId: 'client-fallback-skill',
        entityKind: 'skill',
        image: {
          url: skillImage,
          sourceField: 'clientFallbackDataUrl',
          kind: 'inline',
          isValidUrl: true,
          validationStatus: 'valid',
        },
        raw: {
          source: 'client-fallback',
          reason,
        },
      },
    ],
    rawResponses: [
      {
        id: 'client-fallback',
        receivedAt: new Date().toISOString(),
        body: {
          source: 'client-fallback',
          reason,
        },
      },
    ],
    metadata: {
      title: 'Client Fallback Manifest',
      revision: 'client-fallback',
      warnings: [`Using client fallback assets: ${reason}`],
    },
  };
}

/* ---------- image queue ---------- */

export function queueManifestImages(
  scene: Phaser.Scene,
  manifest: MsuGameManifest,
): QueueResult {
  const entityMap = new Map<string, EntityImageEntry>();
  const keys: string[] = [];
  const queuedKeys: string[] = [];
  const fallbackKeys: string[] = [];

  const entries = buildEntries(manifest);

  for (const entry of entries) {
    entityMap.set(entry.id, entry);
    keys.push(entry.id);

    if (scene.textures.exists(entry.id)) {
      continue;
    }

    const entity = findEntity(manifest, entry.sourceId ?? entry.id);
    if (entity?.image.isValidUrl && entity.image.url) {
      scene.load.image(entry.id, entity.image.url);
      queuedKeys.push(entry.id);
    } else {
      generateFallbackTexture(scene, entry.id, FALLBACK_COLORS[entry.kind]);
      fallbackKeys.push(entry.id);
    }
  }

  return { keys, queuedKeys, fallbackKeys, entityMap };
}

export function installManifestImageFallbacks(
  scene: Phaser.Scene,
  entityMap: ReadonlyMap<string, EntityImageEntry>,
  onFailure: (key: string) => void,
): () => void {
  const onLoadError = (file: { readonly key?: unknown }): void => {
    if (typeof file.key !== 'string') return;

    const entry = entityMap.get(file.key);
    if (entry === undefined) return;

    generateFallbackTexture(scene, entry.id, FALLBACK_COLORS[entry.kind]);
    onFailure(entry.id);
  };

  scene.load.on('loaderror', onLoadError);
  return () => {
    scene.load.off('loaderror', onLoadError);
  };
}

export function createManifestLoadState(
  result: ManifestLoadResult,
  imageFailures: readonly string[],
): ManifestLoadState {
  return {
    source: result.manifest.source,
    usedClientFallback: result.usedClientFallback,
    errorMessage: result.errorMessage,
    imageFailures: [...imageFailures],
    warnings: result.manifest.metadata.warnings,
  };
}

export function storeManifestAssets(
  scene: Phaser.Scene,
  manifest: MsuGameManifest,
  loadState: ManifestLoadState,
): void {
  scene.registry.set(GAME_ASSET_REGISTRY_KEYS.manifest, manifest);
  scene.registry.set(GAME_ASSET_REGISTRY_KEYS.loadState, loadState);
}

export function readManifest(scene: Phaser.Scene): MsuGameManifest {
  const value = scene.registry.get(GAME_ASSET_REGISTRY_KEYS.manifest);
  return isGameManifest(value) ? value : createClientFallbackManifest('manifest_registry_missing');
}

export function readManifestLoadState(scene: Phaser.Scene, manifest: MsuGameManifest): ManifestLoadState {
  const value = scene.registry.get(GAME_ASSET_REGISTRY_KEYS.loadState);
  if (isManifestLoadState(value)) return value;

  return {
    source: manifest.source,
    usedClientFallback: manifest.source === 'fallback',
    errorMessage: null,
    imageFailures: [],
    warnings: manifest.metadata.warnings,
  };
}

export function ensureCoreFallbackTextures(scene: Phaser.Scene): void {
  generateFallbackTexture(scene, CORE_TEXTURE_KEYS.fallbackCharacter, FALLBACK_COLORS.character);
  generateFallbackTexture(scene, CORE_TEXTURE_KEYS.fallbackSkill, FALLBACK_COLORS.skill);
  generateFallbackTexture(scene, CORE_TEXTURE_KEYS.fallbackItem, FALLBACK_COLORS.item);
  generateFallbackTexture(scene, CORE_TEXTURE_KEYS.fallbackIcon, FALLBACK_COLORS.icon);
}

export function resolveTextureKey(
  scene: Phaser.Scene,
  key: string,
  fallbackKey: string,
): string {
  return scene.textures.exists(key) ? key : fallbackKey;
}

/* ---------- fallback texture ---------- */

export function generateFallbackTexture(
  scene: Phaser.Scene,
  key: string,
  color: number,
): void {
  if (scene.textures.exists(key)) return;

  const size = 64;
  const g = scene.add.graphics();

  // filled circle
  g.fillStyle(color, 0.4);
  g.fillCircle(size / 2, size / 2, size / 2 - 1);

  // border ring
  g.lineStyle(2, color, 0.8);
  g.strokeCircle(size / 2, size / 2, size / 2 - 1);

  // center dot
  g.fillStyle(color, 1);
  g.fillCircle(size / 2, size / 2, 4);

  g.generateTexture(key, size, size);
  g.destroy();
}

/* ---------- helpers ---------- */

type ImageEntity = { readonly id: string; readonly image: { readonly isValidUrl: boolean; readonly url: string | null } };

function buildEntries(manifest: MsuGameManifest): readonly EntityImageEntry[] {
  const byId = new Map<string, EntityImageEntry>();
  const add = (entry: EntityImageEntry): void => {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  };

  for (const c of manifest.characters) {
    add({ id: c.id, kind: 'character', name: c.name });
  }
  for (const s of manifest.skills) {
    add({ id: s.id, kind: 'skill', name: s.name });

    if (s.projectile.textureKey !== s.id) {
      add({
        id: s.projectile.textureKey,
        kind: 'skill',
        name: `${s.name} Projectile`,
        sourceId: s.id,
      });
    }
  }
  for (const i of manifest.items) {
    add({ id: i.id, kind: 'item', name: i.name });
  }
  for (const ic of manifest.icons) {
    add({ id: ic.id, kind: 'icon', name: ic.label });
  }

  return [...byId.values()];
}

function findEntity(manifest: MsuGameManifest, id: string): ImageEntity | null {
  const all: readonly ImageEntity[] = [
    ...manifest.characters,
    ...manifest.skills,
    ...manifest.items,
    ...manifest.icons,
  ];
  return all.find((e) => e.id === id) ?? null;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_manifest_error';
}

function isManifestLoadState(value: unknown): value is ManifestLoadState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ManifestLoadState>;

  return (
    (candidate.source === 'msu-cache' || candidate.source === 'msu-proxy' || candidate.source === 'fallback') &&
    typeof candidate.usedClientFallback === 'boolean' &&
    (typeof candidate.errorMessage === 'string' || candidate.errorMessage === null) &&
    Array.isArray(candidate.imageFailures) &&
    candidate.imageFailures.every((key) => typeof key === 'string') &&
    Array.isArray(candidate.warnings) &&
    candidate.warnings.every((warning) => typeof warning === 'string')
  );
}
