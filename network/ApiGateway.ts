export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: (req: ApiRequest) => Promise<ApiResponse>;
}

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApiGateway {
  private readonly routes: ApiRoute[] = [];

  register(route: ApiRoute): void {
    this.routes.push(route);
  }

  async handle(request: ApiRequest): Promise<ApiResponse> {
    const route = this.routes.find(
      r => r.method === request.method.toUpperCase() && r.path === request.path,
    );
    if (!route) return { status: 404, body: { error: 'Not found' } };
    try {
      return await route.handler(request);
    } catch (err) {
      return { status: 500, body: { error: String(err) } };
    }
  }

  listRoutes(): Pick<ApiRoute, 'method' | 'path'>[] {
    return this.routes.map(r => ({ method: r.method, path: r.path }));
  }
}
