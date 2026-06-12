declare const process: {
  env: Record<string, string | undefined>;
};

declare module 'node:fs' {
  export const createReadStream: (path: string) => { pipe: (target: unknown) => void };
  export const existsSync: (path: string) => boolean;
  export const readFileSync: (path: string, encoding: 'utf8') => string;
  export const statSync: (path: string) => { isFile: () => boolean };
}

declare module 'node:http' {
  type HeaderValue = string | string[] | undefined;

  export type IncomingMessage = {
    headers: Record<string, HeaderValue> & { host?: HeaderValue };
    method?: string;
    url?: string;
    on: {
      (event: 'data', listener: (chunk: unknown) => void): IncomingMessage;
      (event: 'end' | 'error', listener: () => void): IncomingMessage;
    };
  };

  export type ServerResponse = {
    end: (data?: string) => void;
    writeHead: (statusCode: number, headers?: Record<string, string>) => void;
  };

  export const createServer: (
    handler: (request: IncomingMessage, response: ServerResponse) => void
  ) => {
    listen: (port: number, hostname: string, listener?: () => void) => void;
  };
}

declare module 'node:path' {
  const path: {
    dirname: (path: string) => string;
    extname: (path: string) => string;
    join: (...paths: string[]) => string;
    normalize: (path: string) => string;
    resolve: (...paths: string[]) => string;
    sep: string;
  };

  export default path;
}

declare module 'node:url' {
  export const fileURLToPath: (url: string | URL) => string;
}
