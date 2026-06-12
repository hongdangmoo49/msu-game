interface CacheEntry<TValue> {
  readonly value: TValue;
  readonly cachedAt: number;
  readonly expiresAt: number;
}

export interface CacheHit<TValue> {
  readonly hit: true;
  readonly value: TValue;
  readonly cachedAt: string;
  readonly expiresAt: string;
  readonly ageMs: number;
}

export interface CacheMiss {
  readonly hit: false;
}

export type CacheLookup<TValue> = CacheHit<TValue> | CacheMiss;

export interface TtlCacheOptions {
  readonly ttlMs?: number;
  readonly maxEntries?: number;
  readonly now?: () => number;
}

export interface CacheStats {
  readonly size: number;
  readonly maxEntries: number;
  readonly ttlMs: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 250;

export class TtlCache<TValue> {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, CacheEntry<TValue>>();

  constructor(options: TtlCacheOptions = {}) {
    this.ttlMs = normalizePositiveInteger(options.ttlMs, DEFAULT_TTL_MS);
    this.maxEntries = normalizePositiveInteger(options.maxEntries, DEFAULT_MAX_ENTRIES);
    this.now = options.now ?? Date.now;
  }

  get(key: string): CacheLookup<TValue> {
    const entry = this.entries.get(key);

    if (entry === undefined) {
      return { hit: false };
    }

    const now = this.now();

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return { hit: false };
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return {
      hit: true,
      value: entry.value,
      cachedAt: new Date(entry.cachedAt).toISOString(),
      expiresAt: new Date(entry.expiresAt).toISOString(),
      ageMs: now - entry.cachedAt
    };
  }

  set(key: string, value: TValue, ttlMs = this.ttlMs): void {
    const normalizedTtlMs = normalizePositiveInteger(ttlMs, this.ttlMs);
    const cachedAt = this.now();

    this.entries.delete(key);
    this.entries.set(key, {
      value,
      cachedAt,
      expiresAt: cachedAt + normalizedTtlMs
    });

    this.pruneExpired(cachedAt);
    this.pruneOldest();
  }

  clear(): void {
    this.entries.clear();
  }

  stats(): CacheStats {
    return {
      size: this.entries.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs
    };
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private pruneOldest(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (oldestKey === undefined) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }
}

export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`;
};

export const buildCacheKey = (...parts: readonly unknown[]): string =>
  parts.map((part) => stableStringify(part)).join('|');

const normalizePositiveInteger = (value: number | undefined, fallback: number): number => {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.trunc(value);
};
