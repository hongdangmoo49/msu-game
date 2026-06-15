import type { IncomingMessage, ServerResponse } from 'node:http';

export const resourceImageRoutePath = '/api/resource-image';

const ALLOWED_HOST = 'resource-static.msu.io';
const ALLOWED_PATH_PREFIX = '/data/';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const json = (data: unknown): string => JSON.stringify(data);

export const isResourceImageRoute = (pathname: string): boolean => pathname === resourceImageRoutePath;

export const proxyResourceImageUrl = (url: string): string => {
  const params = new URLSearchParams({ url });
  return `${resourceImageRoutePath}?${params}`;
};

export const isProxyableResourceImageUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === ALLOWED_HOST &&
      url.pathname.startsWith(ALLOWED_PATH_PREFIX);
  } catch {
    return false;
  }
};

export const handleResourceImageRoute = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL
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

  const target = requestUrl.searchParams.get('url');

  if (target === null || !isProxyableResourceImageUrl(target)) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(json({ error: 'invalid_resource_image_url' }));
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const upstream = await fetch(target, {
      headers: { accept: 'image/*' },
      signal: controller.signal
    });

    if (!upstream.ok) {
      response.writeHead(upstream.status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(json({ error: 'resource_image_fetch_failed' }));
      return;
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      response.writeHead(415, { 'content-type': 'application/json; charset=utf-8' });
      response.end(json({ error: 'resource_image_not_image' }));
      return;
    }

    const contentLength = Number(upstream.headers.get('content-length') ?? '0');
    if (contentLength > MAX_IMAGE_BYTES) {
      response.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
      response.end(json({ error: 'resource_image_too_large' }));
      return;
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      response.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
      response.end(json({ error: 'resource_image_too_large' }));
      return;
    }

    response.writeHead(200, {
      'cache-control': 'public, max-age=86400',
      'content-length': String(bytes.byteLength),
      'content-type': contentType,
      'x-msu-resource-proxy': 'resource-static'
    });

    if (method === 'HEAD') {
      response.end();
      return;
    }

    response.end(bytes);
  } catch {
    response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    response.end(json({ error: 'resource_image_proxy_error' }));
  } finally {
    clearTimeout(timeout);
  }
};
