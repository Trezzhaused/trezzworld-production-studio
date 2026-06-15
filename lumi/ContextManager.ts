export interface ContextRecord {
  id: string;
  category: 'conversation'|'goal'|'asset'|'repository'|'runtime'|'custom';
  key: string;
  value: unknown;
  priority: number;
  updatedAt: string;
}

export class ContextManager {
  private readonly contexts = new Map<string, ContextRecord>();

  set(record: Omit<ContextRecord,'updatedAt'>): ContextRecord {
    const ctx: ContextRecord = { ...record, updatedAt: new Date().toISOString() };
    this.contexts.set(ctx.id, ctx);
    return ctx;
  }

  get(id: string): ContextRecord | undefined {
    return this.contexts.get(id);
  }

  list(): ContextRecord[] {
    return [...this.contexts.values()].sort((a,b)=>b.priority-a.priority);
  }

  findByCategory(category: ContextRecord['category']): ContextRecord[] {
    return [...this.contexts.values()].filter(c=>c.category===category);
  }

  remove(id:string): boolean {
    return this.contexts.delete(id);
  }

  clear(): void {
    this.contexts.clear();
  }
}
