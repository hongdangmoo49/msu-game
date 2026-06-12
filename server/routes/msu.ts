import type { IncomingMessage, ServerResponse } from 'node:http';
import { MSU_ENDPOINTS, type MsuEndpointId } from '../../src/msu/endpoints';
import type {
  MsuEndpointDefinition,
  MsuQuery,
  MsuQueryPrimitive,
  MsuQueryValue
} from '../../src/msu/types';
import { fetchMsu, getMsuCacheStats, MsuClientConfigError } from '../msuClient';

type HeaderValue = string | readonly string[] | undefined;

interface ParsedProxyInput {
  readonly pathParams: Record<string, MsuQueryPrimitive>;
  readonly query: MsuQuery;
  readonly body?: unknown;
  readonly useCache?: boolean;
}

class RouteError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const MAX_BODY_BYTES = 64 * 1024;
const CONTROL_QUERY_KEYS = new Set(['cache']);

export const handleMsuRoute = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL
): Promise<boolean> => {
  if (requestUrl.pathname !== '/api/msu' && !requestUrl.pathname.startsWith('/api/msu/')) {
    return false;
  }

  try {
    if (requestUrl.pathname === '/api/msu' || requestUrl.pathname === '/api/msu/') {
      sendJson(response, 200, {
        endpoints: (Object.values(MSU_ENDPOINTS) as readonly MsuEndpointDefinition[]).map((endpoint) => ({
          id: endpoint.id,
          method: endpoint.method,
          group: endpoint.group,
          pathParams: endpoint.pathParams ?? [],
          queryParams: endpoint.queryParams ?? [],
          supportsMsuAuthorization: endpoint.supportsMsuAuthorization === true
        })),
        cache: getMsuCacheStats()
      });
      return true;
    }

    const endpointId = decodeEndpointId(requestUrl.pathname);

    if (!isMsuEndpointId(endpointId)) {
      sendJson(response, 404, {
        error: 'msu_endpoint_not_found',
        message: `Unknown MSU endpoint: ${endpointId}`
      });
      return true;
    }

    const endpoint: MsuEndpointDefinition = MSU_ENDPOINTS[endpointId];
    const method = request.method ?? 'GET';

    if (method !== 'GET' && method !== 'POST') {
      sendJson(response, 405, { error: 'method_not_allowed' }, { allow: 'GET, POST' });
      return true;
    }

    if (endpoint.method === 'POST' && method !== 'POST') {
      sendJson(response, 405, { error: 'method_not_allowed' }, { allow: 'POST' });
      return true;
    }

    const input =
      method === 'GET'
        ? parseGetInput(endpoint, requestUrl.searchParams)
        : await parsePostInput(endpoint, request);

    const result = await fetchMsu({
      endpointId,
      pathParams: input.pathParams,
      query: input.query,
      body: input.body,
      msuAuthorization: endpoint.supportsMsuAuthorization
        ? getRequestHeader(request.headers, 'msu-authorization')
        : undefined,
      useCache: input.useCache
    });

    sendJson(
      response,
      result.status,
      result.body,
      {
        'x-msu-cache': result.cache.hit ? 'hit' : 'miss',
        ...(result.traceId === undefined ? {} : { 'x-msu-trace-id': result.traceId })
      }
    );
  } catch (error) {
    if (error instanceof RouteError) {
      sendJson(response, error.status, {
        error: error.code,
        message: error.message
      });
      return true;
    }

    if (error instanceof MsuClientConfigError) {
      sendJson(response, 503, {
        error: error.code,
        message: error.message
      });
      return true;
    }

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'msu_route_error',
        message: error instanceof Error ? error.message : 'Unknown route error'
      })
    );
    sendJson(response, 500, { error: 'msu_proxy_error' });
  }

  return true;
};

const decodeEndpointId = (pathname: string): string => {
  const encodedId = pathname.slice('/api/msu/'.length);

  if (encodedId.includes('/')) {
    return '';
  }

  try {
    return decodeURIComponent(encodedId);
  } catch {
    return '';
  }
};

const isMsuEndpointId = (value: string): value is MsuEndpointId =>
  Object.prototype.hasOwnProperty.call(MSU_ENDPOINTS, value);

const parseGetInput = (
  endpoint: MsuEndpointDefinition,
  searchParams: URLSearchParams
): ParsedProxyInput => {
  const pathParams: Record<string, MsuQueryPrimitive> = {};
  const query: MsuQuery = {};
  const pathParamKeys = new Set(endpoint.pathParams ?? []);
  const queryParamKeys = new Set(endpoint.queryParams ?? []);
  let useCache: boolean | undefined;

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);

    if (CONTROL_QUERY_KEYS.has(key)) {
      useCache = parseCacheFlag(values);
      continue;
    }

    if (pathParamKeys.has(key)) {
      if (values.length !== 1 || values[0] === '') {
        throw new RouteError(400, 'invalid_path_param', `Invalid path param: ${key}`);
      }

      pathParams[key] = values[0];
      continue;
    }

    if (queryParamKeys.has(key)) {
      query[key] = values.length === 1 ? values[0] : values;
      continue;
    }

    throw new RouteError(400, 'unknown_query_param', `Query param not allowed: ${key}`);
  }

  assertRequiredPathParams(endpoint, pathParams);

  return { pathParams, query, useCache };
};

const parsePostInput = async (
  endpoint: MsuEndpointDefinition,
  request: IncomingMessage
): Promise<ParsedProxyInput> => {
  const rawBody = await readJsonRequestBody(request);
  const bodyRecord = asRecord(rawBody, 'request body');
  const pathParams = asPrimitiveRecord(bodyRecord.pathParams, 'pathParams');
  const query = asQuery(bodyRecord.query, 'query');

  assertAllowedKeys(pathParams, new Set(endpoint.pathParams ?? []), 'pathParams');
  assertAllowedKeys(query, new Set(endpoint.queryParams ?? []), 'query');
  assertRequiredPathParams(endpoint, pathParams);

  return {
    pathParams,
    query,
    body: Object.prototype.hasOwnProperty.call(bodyRecord, 'body') ? bodyRecord.body : undefined,
    useCache: parseOptionalBoolean(bodyRecord.cache, 'cache')
  };
};

const readJsonRequestBody = async (request: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let receivedBytes = 0;
    let body = '';
    let settled = false;

    const settle = (action: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      action();
    };

    request.on('data', (chunk: unknown) => {
      const chunkText = decodeChunk(chunk);
      receivedBytes += chunkText.length;

      if (receivedBytes > MAX_BODY_BYTES) {
        settle(() =>
          reject(new RouteError(413, 'request_body_too_large', 'Request body exceeds 64 KB.'))
        );
        return;
      }

      body += chunkText;
    });

    request.on('end', () => {
      settle(() => {
        if (body.trim() === '') {
          resolve({});
          return;
        }

        try {
          resolve(JSON.parse(body) as unknown);
        } catch {
          reject(new RouteError(400, 'invalid_json', 'Request body must be valid JSON.'));
        }
      });
    });

    request.on('error', () => {
      settle(() => reject(new RouteError(400, 'request_read_failed', 'Failed to read request body.')));
    });
  });

const decodeChunk = (chunk: unknown): string => {
  if (typeof chunk === 'string') {
    return chunk;
  }

  if (chunk instanceof Uint8Array) {
    return new TextDecoder().decode(chunk);
  }

  return String(chunk);
};

const asRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new RouteError(400, 'invalid_request_body', `${label} must be object.`);
};

const asPrimitiveRecord = (
  value: unknown,
  label: string
): Record<string, MsuQueryPrimitive> => {
  if (value === undefined) {
    return {};
  }

  const record = asRecord(value, label);
  const result: Record<string, MsuQueryPrimitive> = {};

  for (const [key, entryValue] of Object.entries(record)) {
    if (!isQueryPrimitive(entryValue)) {
      throw new RouteError(400, 'invalid_path_param', `${label}.${key} must be primitive.`);
    }

    result[key] = entryValue;
  }

  return result;
};

const asQuery = (value: unknown, label: string): MsuQuery => {
  if (value === undefined) {
    return {};
  }

  const record = asRecord(value, label);
  const result: Record<string, MsuQueryValue> = {};

  for (const [key, entryValue] of Object.entries(record)) {
    if (!isQueryValue(entryValue)) {
      throw new RouteError(400, 'invalid_query_param', `${label}.${key} must be primitive or array.`);
    }

    result[key] = entryValue;
  }

  return result;
};

const isQueryPrimitive = (value: unknown): value is MsuQueryPrimitive =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const isQueryValue = (value: unknown): value is MsuQueryValue =>
  value === null ||
  value === undefined ||
  isQueryPrimitive(value) ||
  (Array.isArray(value) && value.every(isQueryPrimitive));

const assertAllowedKeys = (
  values: Record<string, unknown>,
  allowedKeys: Set<string>,
  label: string
): void => {
  for (const key of Object.keys(values)) {
    if (!allowedKeys.has(key)) {
      throw new RouteError(400, 'unknown_param', `${label}.${key} is not allowed.`);
    }
  }
};

const assertRequiredPathParams = (
  endpoint: MsuEndpointDefinition,
  pathParams: Record<string, MsuQueryPrimitive>
): void => {
  for (const key of endpoint.pathParams ?? []) {
    const value = pathParams[key];

    if (value === undefined || value === null || String(value) === '') {
      throw new RouteError(400, 'missing_path_param', `Missing path param: ${key}`);
    }
  }
};

const parseCacheFlag = (values: readonly string[]): boolean | undefined => {
  if (values.length !== 1) {
    throw new RouteError(400, 'invalid_cache_flag', 'cache must appear once.');
  }

  return parseOptionalBoolean(values[0], 'cache');
};

const parseOptionalBoolean = (value: unknown, label: string): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === true || value === 'true' || value === '1') {
    return true;
  }

  if (value === false || value === 'false' || value === '0') {
    return false;
  }

  throw new RouteError(400, 'invalid_boolean', `${label} must be boolean.`);
};

const getRequestHeader = (
  headers: IncomingMessage['headers'],
  name: string
): string | undefined => {
  const value = headers[name.toLowerCase()] as HeaderValue;

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
};

const sendJson = (
  response: ServerResponse,
  status: number,
  data: unknown,
  headers: Record<string, string> = {}
): void => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers
  });
  response.end(JSON.stringify(data));
};
