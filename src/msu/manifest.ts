import type { UnknownRecord } from './types';

export const MSU_GAME_MANIFEST_SCHEMA_VERSION = 1;

export type MsuGameManifestSource = 'msu-cache' | 'msu-proxy' | 'fallback';
export type MsuGameManifestEntityKind = 'character' | 'skill' | 'item';
export type ManifestImageKind = 'remote' | 'inline' | 'local' | 'missing';
export type ManifestImageValidationStatus =
  | 'valid'
  | 'missing'
  | 'invalid_url'
  | 'invalid_protocol';

export interface ManifestImageRef {
  readonly url: string | null;
  readonly sourceField?: string;
  readonly kind: ManifestImageKind;
  readonly isValidUrl: boolean;
  readonly validationStatus: ManifestImageValidationStatus;
}

export interface ManifestProjectileSpec {
  readonly textureKey: string;
  readonly tint: string;
  readonly speed: number;
  readonly fireRateMs: number;
  readonly damage: number;
}

export interface MsuGameCharacter {
  readonly id: string;
  readonly kind: 'character';
  readonly assetKey?: string;
  readonly tokenId?: string;
  readonly name: string;
  readonly job?: string;
  readonly level?: number;
  readonly image: ManifestImageRef;
  readonly raw: UnknownRecord;
}

export interface MsuGameSkill {
  readonly id: string;
  readonly kind: 'skill';
  readonly skillId?: string;
  readonly nodeId?: string;
  readonly name: string;
  readonly description?: string;
  readonly level?: number;
  readonly image: ManifestImageRef;
  readonly projectile: ManifestProjectileSpec;
  readonly raw: UnknownRecord;
}

export interface MsuGameItem {
  readonly id: string;
  readonly kind: 'item';
  readonly assetKey?: string;
  readonly tokenId?: string;
  readonly itemId?: string;
  readonly name: string;
  readonly category?: string;
  readonly image: ManifestImageRef;
  readonly raw: UnknownRecord;
}

export interface MsuGameIcon {
  readonly id: string;
  readonly label: string;
  readonly entityId?: string;
  readonly entityKind?: MsuGameManifestEntityKind;
  readonly image: ManifestImageRef;
  readonly raw: UnknownRecord;
}

export interface MsuManifestRawResponse {
  readonly id: string;
  readonly endpointId?: string;
  readonly path?: string;
  readonly receivedAt?: string;
  readonly body: unknown;
}

export interface MsuGameManifestMetadata {
  readonly title: string;
  readonly revision: string;
  readonly warnings: readonly string[];
}

export interface MsuGameManifest {
  readonly schemaVersion: typeof MSU_GAME_MANIFEST_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly source: MsuGameManifestSource;
  readonly characters: readonly MsuGameCharacter[];
  readonly skills: readonly MsuGameSkill[];
  readonly items: readonly MsuGameItem[];
  readonly icons: readonly MsuGameIcon[];
  readonly rawResponses: readonly MsuManifestRawResponse[];
  readonly metadata: MsuGameManifestMetadata;
}

const VALID_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'data:']);

export const createMissingImageRef = (sourceField?: string): ManifestImageRef => ({
  url: null,
  sourceField,
  kind: 'missing',
  isValidUrl: false,
  validationStatus: 'missing'
});

export const validateManifestImageUrl = (
  value: unknown,
  sourceField?: string
): ManifestImageRef => {
  if (typeof value !== 'string' || value.trim() === '') {
    return createMissingImageRef(sourceField);
  }

  const url = value.trim();

  if (url.startsWith('/')) {
    return {
      url,
      sourceField,
      kind: 'local',
      isValidUrl: true,
      validationStatus: 'valid'
    };
  }

  try {
    const parsed = new URL(url);

    if (!VALID_IMAGE_PROTOCOLS.has(parsed.protocol)) {
      return {
        url,
        sourceField,
        kind: 'missing',
        isValidUrl: false,
        validationStatus: 'invalid_protocol'
      };
    }

    if (parsed.protocol === 'data:' && !url.startsWith('data:image/')) {
      return {
        url,
        sourceField,
        kind: 'inline',
        isValidUrl: false,
        validationStatus: 'invalid_protocol'
      };
    }

    return {
      url,
      sourceField,
      kind: parsed.protocol === 'data:' ? 'inline' : 'remote',
      isValidUrl: true,
      validationStatus: 'valid'
    };
  } catch {
    return {
      url,
      sourceField,
      kind: 'missing',
      isValidUrl: false,
      validationStatus: 'invalid_url'
    };
  }
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isManifestImageRef = (value: unknown): value is ManifestImageRef =>
  isRecord(value) &&
  (typeof value.url === 'string' || value.url === null) &&
  typeof value.kind === 'string' &&
  typeof value.isValidUrl === 'boolean' &&
  typeof value.validationStatus === 'string';

const hasRawRecord = (value: UnknownRecord): boolean => isRecord(value.raw);

const isManifestCharacter = (value: unknown): value is MsuGameCharacter =>
  isRecord(value) &&
  value.kind === 'character' &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  isManifestImageRef(value.image) &&
  hasRawRecord(value);

const isManifestSkill = (value: unknown): value is MsuGameSkill =>
  isRecord(value) &&
  value.kind === 'skill' &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  isManifestImageRef(value.image) &&
  isRecord(value.projectile) &&
  typeof value.projectile.textureKey === 'string' &&
  typeof value.projectile.tint === 'string' &&
  typeof value.projectile.speed === 'number' &&
  typeof value.projectile.fireRateMs === 'number' &&
  typeof value.projectile.damage === 'number' &&
  hasRawRecord(value);

const isManifestItem = (value: unknown): value is MsuGameItem =>
  isRecord(value) &&
  value.kind === 'item' &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  isManifestImageRef(value.image) &&
  hasRawRecord(value);

const isManifestIcon = (value: unknown): value is MsuGameIcon =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  isManifestImageRef(value.image) &&
  hasRawRecord(value);

const isRawResponse = (value: unknown): value is MsuManifestRawResponse =>
  isRecord(value) && typeof value.id === 'string' && 'body' in value;

export const isGameManifest = (value: unknown): value is MsuGameManifest =>
  isRecord(value) &&
  value.schemaVersion === MSU_GAME_MANIFEST_SCHEMA_VERSION &&
  typeof value.generatedAt === 'string' &&
  (value.source === 'msu-cache' || value.source === 'msu-proxy' || value.source === 'fallback') &&
  Array.isArray(value.characters) &&
  value.characters.every(isManifestCharacter) &&
  Array.isArray(value.skills) &&
  value.skills.every(isManifestSkill) &&
  Array.isArray(value.items) &&
  value.items.every(isManifestItem) &&
  Array.isArray(value.icons) &&
  value.icons.every(isManifestIcon) &&
  Array.isArray(value.rawResponses) &&
  value.rawResponses.every(isRawResponse) &&
  isRecord(value.metadata) &&
  typeof value.metadata.title === 'string' &&
  typeof value.metadata.revision === 'string' &&
  Array.isArray(value.metadata.warnings) &&
  value.metadata.warnings.every((warning) => typeof warning === 'string');

export const hasManifestReferences = (manifest: MsuGameManifest): boolean =>
  manifest.characters.length > 0 ||
  manifest.skills.length > 0 ||
  manifest.items.length > 0 ||
  manifest.icons.length > 0;
