import type { Server as BunServer } from 'bun';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

interface Route {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
}

export type RouteHandler = (req: Request, params?: Record<string, string>) => Response | Promise<Response>;

interface ServerOptions {
  port?: number;
  hostname?: string;
}

export class BunServerWrapper {
  private routes: Route[] = [];
  private server: BunServer<never> | null = null;
  private options: Required<ServerOptions>;

  constructor(options: ServerOptions = {}) {
    this.options = {
      port: options.port || 3000,
      hostname: options.hostname || 'localhost',
    };
  }

  /**
   * Adds a GET route
   */
  public get(path: string, handler: RouteHandler): void {
    this.addRoute('GET', path, handler);
  }

  /**
   * Adds a POST route
   */
  public post(path: string, handler: RouteHandler): void {
    this.addRoute('POST', path, handler);
  }

  /**
   * Adds a PUT route
   */
  public put(path: string, handler: RouteHandler): void {
    this.addRoute('PUT', path, handler);
  }

  /**
   * Adds a DELETE route
   */
  public delete(path: string, handler: RouteHandler): void {
    this.addRoute('DELETE', path, handler);
  }

  /**
   * Adds a PATCH route
   */
  public patch(path: string, handler: RouteHandler): void {
    this.addRoute('PATCH', path, handler);
  }

  /**
   * Adds an any route with specified method
   */
  private addRoute(method: HttpMethod, path: string, handler: RouteHandler): void {
    this.routes.push({ method, path, handler });
  }

  /**
   * Starts the server
   */
  public start(): void {
    this.server = Bun.serve({
      port: this.options.port,
      hostname: this.options.hostname,
      fetch: async (req: Request, server) => {
        
        if (server.upgrade(req, { data: { unauthorized: true } })) {
          return;
        }

        return await this.handleRequest(req);
      },
      websocket: {
        message: (ws, message) => {
          console.log('Received WebSocket message:', message);
          ws.send(`Echo: ${message}`);
        },
      },
      error: (error: Error) => {
        console.error('Server error:', error);
      },
    });

    console.log(`🚀 Server is running at http://${this.options.hostname}:${this.options.port}`);
  }

  /**
   * Stops the server
   */
  public stop(): void {
    if (this.server) {
      this.server.stop();
      console.log('🛑 Server stopped');
      this.server = null;
    }
  }

  /**
   * Handles incoming requests by matching them to registered routes and invoking the appropriate handler
   */
  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = req.method as HttpMethod;
    const pathname = url.pathname;

    // search for a matching route
    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }

      const params = this.matchRoute(pathname, route.path);
      if (params !== null) {
        try {
          return await route.handler(req, params);
        } catch (error) {
          console.error('Ошибка обработки маршрута:', error);
          return this.jsonResponse(
            { error: 'Internal Server Error' },
            500
          );
        }
      }
    }

    // route not found
    return this.jsonResponse({ error: 'Not Found' }, 404);
  }

  /**
   * Matches the request path to the route and extracts parameters
   * Supports dynamic parameters like /users/:id
   */
  private matchRoute(pathname: string, routePath: string): Record<string, string> | null {
    const pathParts = pathname.split('/').filter(Boolean);
    const routeParts = routePath.split('/').filter(Boolean);

    if (pathParts.length !== routeParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (routePart.startsWith(':')) {
        // Dynamic parameter
        const paramName = routePart.slice(1);
        params[paramName] = pathPart;
      } else if (routePart !== pathPart) {
        // Static part does not match
        return null;
      }
    }

    return params;
  }

  /**
   * Supply helper method to create JSON response
   */
  public jsonResponse(data: any, status: number = 200): Response {
    // allow policy cors
    const headerAllowPolicy = { 'Access-Control-Allow-Origin': '*' };
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headerAllowPolicy,
      },
    });
  }

  /**
   * Supply helper method to create plain text response
   */
  public textResponse(text: string, status: number = 200): Response {
    return new Response(text, {
      status,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  /**
   * Supply helper method to create HTML response
   */
  public htmlResponse(html: string, status: number = 200): Response {
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }

  /**
   * Supply helper method to parse JSON from request body
   */
  public async parseJson<T = any>(req: Request): Promise<T> {
    try {
      return await req.json() as T;
    } catch (error) {
      throw new Error('Невозможно распарсить JSON');
    }
  }

  /**
   * Supply helper method to parse FormData from request body
   */
  public async parseFormData(req: Request): Promise<FormData> {
    try {
      return await req.formData();
    } catch (error) {
      throw new Error('Невозможно распарсить FormData');
    }
  }

  /**
   * Supply helper method to get query parameters from URL
   */
  public getQueryParams(req: Request): URLSearchParams {
    const url = new URL(req.url);
    return url.searchParams;
  }

  /**
   * Supply helper method to get server info
   */
  public getServerInfo(): { port: number; hostname: string; isRunning: boolean } {
    return {
      port: this.options.port,
      hostname: this.options.hostname,
      isRunning: this.server !== null,
    };
  }
}
