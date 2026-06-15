import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleManifestRoute, isManifestRoute } from './routes/manifest';
import { handleMsuRoute } from './routes/msu';
import { handleResourceImageRoute, isResourceImageRoute } from './routes/resourceImage';

const port = Number(process.env.PORT ?? 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client');

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const json = (data: unknown): string => JSON.stringify(data);

const isFile = (filePath: string): boolean => existsSync(filePath) && statSync(filePath).isFile();

const resolveStaticFile = (pathname: string): string | null => {
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = path.normalize(decodedPath).replace(/^[/\\]+/, '');
  const requestedPath = path.resolve(clientDistPath, relativePath === '.' ? 'index.html' : relativePath);
  const isInsideClientDist =
    requestedPath === clientDistPath || requestedPath.startsWith(`${clientDistPath}${path.sep}`);

  if (!isInsideClientDist) {
    return null;
  }

  return isFile(requestedPath) ? requestedPath : path.join(clientDistPath, 'index.html');
};

const handleRequest = async (
  request: Parameters<Parameters<typeof createServer>[0]>[0],
  response: Parameters<Parameters<typeof createServer>[0]>[1]
): Promise<void> => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (requestUrl.pathname === '/api/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(json({ ok: true, service: 'msu-server' }));
    return;
  }

  if (isManifestRoute(requestUrl.pathname)) {
    await handleManifestRoute(request, response);
    return;
  }

  if (isResourceImageRoute(requestUrl.pathname)) {
    await handleResourceImageRoute(request, response, requestUrl);
    return;
  }

  if (await handleMsuRoute(request, response, requestUrl)) {
    return;
  }

  const filePath = resolveStaticFile(requestUrl.pathname);

  if (filePath === null) {
    response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    response.end(json({ error: 'invalid_path' }));
    return;
  }

  const extension = path.extname(filePath);

  if (!isFile(filePath)) {
    response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    response.end(json({ error: 'client_build_missing' }));
    return;
  }

  response.writeHead(200, {
    'content-type': contentTypes[extension] ?? 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
};

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'server_request_error',
        message: error instanceof Error ? error.message : 'Unknown request error'
      })
    );
    response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    response.end(json({ error: 'internal_server_error' }));
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`MSU server listening on http://localhost:${port}`);
});
