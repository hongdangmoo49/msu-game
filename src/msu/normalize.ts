import {
  MSU_GAME_MANIFEST_SCHEMA_VERSION,
  createMissingImageRef,
  hasManifestReferences,
  isGameManifest,
  validateManifestImageUrl,
  type ManifestImageRef,
  type MsuGameCharacter,
  type MsuGameIcon,
  type MsuGameItem,
  type MsuGameManifest,
  type MsuGameManifestEntityKind,
  type MsuGameManifestSource,
  type MsuGameSkill,
  type MsuManifestRawResponse
} from './manifest';
import type { UnknownRecord } from './types';

export interface NormalizeMsuManifestOptions {
  readonly generatedAt?: string;
  readonly source?: MsuGameManifestSource;
  readonly revision?: string;
  readonly title?: string;
}

interface Buckets {
  readonly characters: UnknownRecord[];
  readonly skills: UnknownRecord[];
  readonly items: UnknownRecord[];
  readonly icons: UnknownRecord[];
}

const IMAGE_FIELDS = [
  'nodeImageUrl',
  'imageUrl',
  'iconUrl',
  'thumbnailUrl',
  'characterImageUrl',
  'itemImageUrl',
  'itemIconUrl',
  'skillIconUrl',
  'image_url',
  'icon_url',
  'thumbnail_url'
] as const;

const PROJECTILE_TINTS = [
  '#38bdf8',
  '#f472b6',
  '#facc15',
  '#4ade80',
  '#fb7185',
  '#a78bfa',
  '#22d3ee',
  '#f97316'
] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecords = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
};

const readString = (record: UnknownRecord, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
};

const readNumber = (record: UnknownRecord, keys: readonly string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const readNestedString = (
  record: UnknownRecord,
  field: string,
  keys: readonly string[]
): string | undefined => {
  const nested = record[field];

  if (!isRecord(nested)) {
    return undefined;
  }

  return readString(nested, keys);
};

const stableHash = (value: unknown): number => {
  let source: string;

  try {
    source = JSON.stringify(value) ?? String(value);
  } catch {
    source = String(value);
  }

  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const slug = (value: string): string => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'unknown';
};

const makeId = (
  prefix: string,
  raw: UnknownRecord,
  candidates: readonly (string | undefined)[]
): string => {
  const candidate = candidates.find((value) => value !== undefined && value.trim() !== '');
  return `${prefix}-${slug(candidate ?? stableHash(raw).toString(36))}`;
};

const findImage = (record: UnknownRecord): ManifestImageRef => {
  for (const field of IMAGE_FIELDS) {
    const image = validateManifestImageUrl(record[field], field);

    if (image.validationStatus !== 'missing') {
      return image;
    }
  }

  for (const field of ['image', 'icon', 'thumbnail']) {
    const nested = record[field];

    if (typeof nested === 'string') {
      return validateManifestImageUrl(nested, field);
    }

    if (isRecord(nested)) {
      const nestedUrl = readString(nested, ['url', 'src', 'imageUrl', 'iconUrl']);

      if (nestedUrl !== undefined) {
        return validateManifestImageUrl(nestedUrl, `${field}.url`);
      }
    }
  }

  return createMissingImageRef();
};

const unwrapPayload = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value;
  }

  if ('body' in value) {
    return unwrapPayload(value.body);
  }

  if ('data' in value) {
    return unwrapPayload(value.data);
  }

  return value;
};

const addRecords = (target: UnknownRecord[], value: unknown): void => {
  target.push(...asRecords(value));
};

const hasVMatrixNodeShape = (record: UnknownRecord): boolean =>
  'nodeImageUrl' in record || 'nodeId' in record || 'nodeName' in record;

const collectFromPayload = (value: unknown, buckets: Buckets): void => {
  const payload = unwrapPayload(value);

  if (!isRecord(payload)) {
    return;
  }

  addRecords(buckets.characters, payload.characters);
  addRecords(buckets.characters, payload.character);
  addRecords(buckets.skills, payload.skills);
  addRecords(buckets.skills, payload.skillMetadata);
  addRecords(buckets.skills, payload.vMatrixNodes);
  addRecords(buckets.skills, payload.vMatrixSlots);
  addRecords(buckets.items, payload.items);
  addRecords(buckets.items, payload.item);
  addRecords(buckets.items, payload.elements);
  addRecords(buckets.icons, payload.icons);

  if (hasVMatrixNodeShape(payload)) {
    buckets.skills.push(payload);
  }
};

const collectRawResponses = (value: unknown): MsuManifestRawResponse[] => {
  if (!isRecord(value)) {
    return [];
  }

  const rawInputs = [...asRecords(value.rawResponses), ...asRecords(value.responses)];

  if (rawInputs.length === 0 && ('success' in value || 'data' in value || 'body' in value)) {
    rawInputs.push(value);
  }

  return rawInputs.map((raw, index) => ({
    id: readString(raw, ['id', 'requestId']) ?? `raw-${index + 1}`,
    endpointId: readString(raw, ['endpointId', 'endpoint']),
    path: readString(raw, ['path', 'url']),
    receivedAt: readString(raw, ['receivedAt', 'cachedAt', 'createdAt']),
    body: raw
  }));
};

const collectAll = (input: unknown): { buckets: Buckets; rawResponses: MsuManifestRawResponse[] } => {
  const buckets: Buckets = {
    characters: [],
    skills: [],
    items: [],
    icons: []
  };
  const rawResponses = collectRawResponses(input);

  collectFromPayload(input, buckets);

  for (const response of rawResponses) {
    collectFromPayload(response.body, buckets);
  }

  if (isRecord(input)) {
    addRecords(buckets.characters, input.characters);
    addRecords(buckets.skills, input.skills);
    addRecords(buckets.items, input.items);
    addRecords(buckets.icons, input.icons);
  }

  return { buckets, rawResponses };
};

const dedupeById = <T extends { readonly id: string }>(items: readonly T[]): T[] => {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      deduped.push(item);
    }
  }

  return deduped;
};

const normalizeCharacter = (raw: UnknownRecord): MsuGameCharacter => {
  const assetKey = readString(raw, ['assetKey', 'asset_key', 'characterAssetKey']);
  const tokenId = readString(raw, ['tokenId', 'token_id']);
  const name =
    readString(raw, ['name', 'characterName', 'nickname', 'displayName']) ?? 'Unknown Character';

  return {
    id: makeId('character', raw, [assetKey, tokenId, name]),
    kind: 'character',
    assetKey,
    tokenId,
    name,
    job: readString(raw, ['job', 'class', 'className', 'characterClass']),
    level: readNumber(raw, ['level', 'characterLevel']),
    image: findImage(raw),
    raw
  };
};

const normalizeSkill = (raw: UnknownRecord): MsuGameSkill => {
  const skillId = readString(raw, ['skillId', 'skill_id', 'id']);
  const nodeId = readString(raw, ['nodeId', 'node_id']);
  const name = readString(raw, ['name', 'skillName', 'nodeName', 'displayName']) ?? 'Unknown Skill';
  const id = makeId('skill', raw, [skillId, nodeId, name]);
  const hash = stableHash(id);
  const tint = PROJECTILE_TINTS[hash % PROJECTILE_TINTS.length];

  return {
    id,
    kind: 'skill',
    skillId,
    nodeId,
    name,
    description: readString(raw, ['description', 'desc', 'skillDesc', 'nodeDesc']),
    level: readNumber(raw, ['level', 'skillLevel', 'nodeLevel']),
    image: findImage(raw),
    projectile: {
      textureKey: `${id}-icon`,
      tint,
      speed: 380 + (hash % 180),
      fireRateMs: 320 + (hash % 240),
      damage: 8 + (hash % 14)
    },
    raw
  };
};

const normalizeItem = (raw: UnknownRecord): MsuGameItem => {
  const assetKey = readString(raw, ['assetKey', 'asset_key', 'itemAssetKey']);
  const tokenId = readString(raw, ['tokenId', 'token_id']);
  const itemId = readString(raw, ['itemId', 'item_id', 'id']);
  const name = readString(raw, ['name', 'itemName', 'displayName']) ?? 'Unknown Item';

  return {
    id: makeId('item', raw, [assetKey, tokenId, itemId, name]),
    kind: 'item',
    assetKey,
    tokenId,
    itemId,
    name,
    category: readString(raw, ['category', 'categoryName']) ?? readNestedString(raw, 'category', ['label']),
    image: findImage(raw),
    raw
  };
};

const normalizeIcon = (raw: UnknownRecord): MsuGameIcon => {
  const label = readString(raw, ['label', 'name', 'displayName']) ?? 'Unknown Icon';

  return {
    id: makeId('icon', raw, [readString(raw, ['id', 'iconId']), label]),
    label,
    image: findImage(raw),
    raw
  };
};

const iconFromEntity = (
  entity: MsuGameCharacter | MsuGameSkill | MsuGameItem
): MsuGameIcon | null => {
  if (!entity.image.isValidUrl || entity.image.url === null) {
    return null;
  }

  return {
    id: `${entity.id}-icon`,
    label: entity.name,
    entityId: entity.id,
    entityKind: entity.kind as MsuGameManifestEntityKind,
    image: entity.image,
    raw: entity.raw
  };
};

const buildWarnings = (manifest: {
  readonly characters: readonly MsuGameCharacter[];
  readonly skills: readonly MsuGameSkill[];
  readonly items: readonly MsuGameItem[];
  readonly icons: readonly MsuGameIcon[];
}): string[] => {
  const warnings: string[] = [];
  const entries = [
    ...manifest.characters,
    ...manifest.skills,
    ...manifest.items,
    ...manifest.icons
  ];
  const invalidImages = entries.filter((entry) => !entry.image.isValidUrl).length;

  if (invalidImages > 0) {
    warnings.push(`${invalidImages} manifest entries have missing or invalid image URLs.`);
  }

  if (
    !hasManifestReferences({
      schemaVersion: MSU_GAME_MANIFEST_SCHEMA_VERSION,
      generatedAt: '',
      source: 'msu-cache',
      characters: manifest.characters,
      skills: manifest.skills,
      items: manifest.items,
      icons: manifest.icons,
      rawResponses: [],
      metadata: { title: '', revision: '', warnings: [] }
    })
  ) {
    warnings.push('Manifest contains no game references.');
  }

  return warnings;
};

export const normalizeMsuManifest = (
  input: unknown,
  options: NormalizeMsuManifestOptions = {}
): MsuGameManifest => {
  if (isGameManifest(input)) {
    return input;
  }

  const { buckets, rawResponses } = collectAll(input);
  const characters = dedupeById(buckets.characters.map(normalizeCharacter));
  const skills = dedupeById(buckets.skills.map(normalizeSkill));
  const items = dedupeById(buckets.items.map(normalizeItem));
  const explicitIcons = buckets.icons.map(normalizeIcon);
  const derivedIcons = [...characters, ...skills, ...items].flatMap((entity) => {
    const icon = iconFromEntity(entity);
    return icon === null ? [] : [icon];
  });
  const icons = dedupeById([...explicitIcons, ...derivedIcons]);
  const manifestShape = { characters, skills, items, icons };

  return {
    schemaVersion: MSU_GAME_MANIFEST_SCHEMA_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: options.source ?? 'msu-cache',
    characters,
    skills,
    items,
    icons,
    rawResponses,
    metadata: {
      title: options.title ?? 'MSU Survival Shooter Manifest',
      revision: options.revision ?? 'generated',
      warnings: buildWarnings(manifestShape)
    }
  };
};
