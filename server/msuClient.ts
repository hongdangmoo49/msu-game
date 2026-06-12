import { buildCacheKey, TtlCache } from './cache';
import {
  buildMsuPath,
  MSU_API_BASE_URL,
  MSU_AUTH_HEADERS,
  MSU_ENDPOINTS,
  type MsuEndpointId
} from '../src/msu/endpoints';
import {
  MSU_ERROR_CODES,
  type MsuEndpointDefinition,
  type MsuQuery,
  type MsuQueryPrimitive
} from '../src/msu/types';

export interface MsuProxyRequest {
  readonly endpointId: MsuEndpointId;
  readonly pathParams?: Record<string, MsuQueryPrimitive>;
  readonly query?: MsuQuery;
  readonly body?: unknown;
  readonly msuAuthorization?: string;
  readonly useCache?: boolean;
}

export interface MsuProxyResult {
  readonly endpointId: MsuEndpointId;
  readonly status: number;
  readonly body: unknown;
  readonly traceId?: string;
  readonly cache: {
    readonly hit: boolean;
    readonly key?: string;
    readonly cachedAt?: string;
    readonly expiresAt?: string;
  };
}

export interface MsuClientOptions {
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly cache?: TtlCache<unknown>;
  readonly cacheTtlMs?: number;
}

export class MsuClientConfigError extends Error {
  readonly code = 'msu_api_key_missing';

  constructor() {
    super('MSU API key missing. Set MSU_API_KEY on server process.');
  }
}

interface MsuErrorBody {
  readonly success?: unknown;
  readonly error?: {
    readonly code?: unknown;
    readonly message?: unknown;
  };
  readonly traceId?: unknown;
  readonly trace_id?: unknown;
}

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const defaultCache = new TtlCache<unknown>({
  ttlMs: readIntegerEnv('MSU_PROXY_CACHE_TTL_MS', DEFAULT_CACHE_TTL_MS),
  maxEntries: readIntegerEnv('MSU_PROXY_CACHE_MAX_ENTRIES', 250)
});

export const fetchMsu = async (
  request: MsuProxyRequest,
  options: MsuClientOptions = {}
): Promise<MsuProxyResult> => {
  const endpoint: MsuEndpointDefinition = MSU_ENDPOINTS[request.endpointId];
  const baseUrl = options.baseUrl ?? MSU_API_BASE_URL;
  const apiKey = resolveApiKey(options.apiKey);
  const pathParams = request.pathParams ?? {};
  const query = request.query ?? {};
  const cache = options.cache ?? defaultCache;
  const url = buildMsuUrl(baseUrl, endpoint.pathTemplate, pathParams, query);
  const cacheKey = buildMsuCacheKey(request);
  const canUseCache =
    request.useCache !== false && endpoint.method === 'GET' && request.msuAuthorization === undefined;

  if (canUseCache) {
    const cached = cache.get(cacheKey);

    if (cached.hit) {
      return {
        endpointId: request.endpointId,
        status: 200,
        body: cached.value,
        traceId: getTraceId(cached.value),
        cache: {
          hit: true,
          key: cacheKey,
          cachedAt: cached.cachedAt,
          expiresAt: cached.expiresAt
        }
      };
    }
  }

  const headers: Record<string, string> = {
    accept: 'application/json',
    [MSU_AUTH_HEADERS.apiKey]: apiKey
  };

  if (endpoint.method === 'POST') {
    headers['content-type'] = 'application/json; charset=utf-8';
  }

  if (endpoint.supportsMsuAuthorization && request.msuAuthorization !== undefined) {
    headers[MSU_AUTH_HEADERS.msuAuthorization] = request.msuAuthorization;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: endpoint.method,
      headers,
      body: endpoint.method === 'POST' && request.body !== undefined ? JSON.stringify(request.body) : undefined
    });
  } catch (error) {
    logMsuFailure({
      event: 'msu_fetch_error',
      endpointId: request.endpointId,
      status: 502,
      message: error instanceof Error ? error.message : 'Unknown fetch error'
    });

    return {
      endpointId: request.endpointId,
      status: 502,
      body: {
        error: 'msu_fetch_failed',
        message: 'MSU upstream request failed.'
      },
      cache: { hit: false, key: cacheKey }
    };
  }

  const body = await readJsonBody(response);
  const traceId = getTraceId(body);
  const status = normalizeResponseStatus(response.status, body);

  if (!response.ok || isMsuFailure(body)) {
    const errorInfo = getMsuErrorInfo(body);

    logMsuFailure({
      event: isRateLimitFailure(response.status, errorInfo.code)
        ? 'msu_rate_limit'
        : 'msu_failure_response',
      endpointId: request.endpointId,
      status,
      traceId,
      errorCode: errorInfo.code,
      message: errorInfo.message
    });
  }

  if (canUseCache && status === 200 && isMsuSuccess(body)) {
    cache.set(cacheKey, body, options.cacheTtlMs);
  }

  return {
    endpointId: request.endpointId,
    status,
    body,
    traceId,
    cache: { hit: false, key: cacheKey }
  };
};

export const getMsuCacheStats = () => defaultCache.stats();

const buildMsuUrl = (
  baseUrl: string,
  pathTemplate: string,
  pathParams: Record<string, MsuQueryPrimitive>,
  query: MsuQuery
): string => {
  const url = new URL(buildMsuPath(pathTemplate, pathParams), baseUrl);

  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(url.searchParams, key, value);
  }

  return url.toString();
};

const appendQueryValue = (searchParams: URLSearchParams, key: string, value: MsuQuery[string]): void => {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      searchParams.append(key, String(item));
    }

    return;
  }

  searchParams.set(key, String(value));
};

const buildMsuCacheKey = (request: MsuProxyRequest): string =>
  buildCacheKey('msu', request.endpointId, MSU_ENDPOINTS[request.endpointId].method, {
    pathParams: request.pathParams ?? {},
    query: request.query ?? {},
    body: request.body ?? null
  });

const resolveApiKey = (override: string | undefined): string => {
  const apiKey =
    override ??
    process.env.MSU_API_KEY ??
    process.env.NXOPEN_API_KEY ??
    process.env.NEXON_OPEN_API_KEY;

  if (apiKey === undefined || apiKey.trim() === '') {
    throw new MsuClientConfigError();
  }

  return apiKey.trim();
};

const readJsonBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();

  if (text.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    logMsuFailure({
      event: 'msu_invalid_json',
      endpointId: 'unknown',
      status: response.status,
      message: 'MSU upstream returned invalid JSON.'
    });

    return {
      error: 'msu_invalid_json',
      message: 'MSU upstream returned invalid JSON.'
    };
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asMsuErrorBody = (body: unknown): MsuErrorBody =>
  isRecord(body) ? (body as MsuErrorBody) : {};

const isMsuSuccess = (body: unknown): boolean => asMsuErrorBody(body).success === true;

const isMsuFailure = (body: unknown): boolean => asMsuErrorBody(body).success === false;

const getTraceId = (body: unknown): string | undefined => {
  const envelope = asMsuErrorBody(body);
  const traceId = envelope.traceId ?? envelope.trace_id;

  return typeof traceId === 'string' && traceId.length > 0 ? traceId : undefined;
};

const getMsuErrorInfo = (
  body: unknown
): { readonly code?: number; readonly message?: string } => {
  const envelope = asMsuErrorBody(body);
  const rawCode = envelope.error?.code;
  const rawMessage = envelope.error?.message;

  return {
    code: typeof rawCode === 'number' ? rawCode : undefined,
    message: typeof rawMessage === 'string' ? rawMessage : undefined
  };
};

const normalizeResponseStatus = (httpStatus: number, body: unknown): number => {
  if (!isMsuFailure(body)) {
    return httpStatus;
  }

  const { code } = getMsuErrorInfo(body);

  switch (code) {
    case MSU_ERROR_CODES.ERROR_CODE_INVALID_ARGUMENT:
      return 400;
    case MSU_ERROR_CODES.ERROR_CODE_NOT_FOUND:
      return 404;
    case MSU_ERROR_CODES.ERROR_CODE_PERMISSION_DENIED:
      return 403;
    case MSU_ERROR_CODES.ERROR_CODE_UNAUTHENTICATED:
    case MSU_ERROR_CODES.ERROR_CODE_INVALID_AUTH_TOKEN:
    case MSU_ERROR_CODES.ERROR_CODE_TOKEN_EXPIRED:
    case MSU_ERROR_CODES.ERROR_CODE_TOKEN_EXPIRED_BY_OTHER_APP:
      return 401;
    case MSU_ERROR_CODES.ERROR_CODE_TOO_MANY_REQUEST:
      return 429;
    default:
      return httpStatus >= 400 ? httpStatus : 502;
  }
};

const isRateLimitFailure = (httpStatus: number, errorCode: number | undefined): boolean =>
  httpStatus === 429 || errorCode === MSU_ERROR_CODES.ERROR_CODE_TOO_MANY_REQUEST;

const logMsuFailure = (entry: {
  readonly event: string;
  readonly endpointId: MsuEndpointId | 'unknown';
  readonly status: number;
  readonly traceId?: string;
  readonly errorCode?: number;
  readonly message?: string;
}): void => {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...entry }));
};

function readIntegerEnv(key: string, fallback: number): number {
  const value = process.env[key];

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}
