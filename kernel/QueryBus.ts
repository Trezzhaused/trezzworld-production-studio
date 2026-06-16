export interface Query {
  readonly queryType: string;
  [key: string]: unknown;
}

export type QueryHandler<Q extends Query = Query, R = unknown> = (query: Q) => Promise<R>;

export class QueryBus {
  private readonly handlers = new Map<string, QueryHandler<Query, unknown>>();

  register<Q extends Query, R>(type: string, handler: QueryHandler<Q, R>): void {
    if (this.handlers.has(type)) throw new Error(`Query handler already registered: ${type}`);
    this.handlers.set(type, handler as QueryHandler<Query, unknown>);
  }

  unregister(type: string): void { this.handlers.delete(type); }

  async execute<R = unknown>(query: Query): Promise<R> {
    const handler = this.handlers.get(query.queryType);
    if (!handler) throw new Error(`No handler for query: ${query.queryType}`);
    return handler(query) as Promise<R>;
  }

  has(type: string): boolean { return this.handlers.has(type); }
  list(): string[] { return [...this.handlers.keys()]; }
}
