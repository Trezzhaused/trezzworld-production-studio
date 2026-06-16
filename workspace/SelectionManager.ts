export interface SelectionItem {
  id: string;
  type: string;
  path?: string;
}

export class SelectionManager {
  private readonly selected = new Map<string, SelectionItem>();
  private primaryId?: string;

  select(item: SelectionItem, primary = false): void {
    this.selected.set(item.id, { ...item });
    if (primary || this.selected.size === 1) this.primaryId = item.id;
  }

  deselect(id: string): void {
    this.selected.delete(id);
    if (this.primaryId === id) {
      this.primaryId = this.selected.size > 0 ? [...this.selected.keys()][0] : undefined;
    }
  }

  toggle(item: SelectionItem): void {
    if (this.selected.has(item.id)) this.deselect(item.id);
    else this.select(item);
  }

  clearAll(): void {
    this.selected.clear();
    this.primaryId = undefined;
  }

  getPrimary(): SelectionItem | undefined {
    return this.primaryId ? this.selected.get(this.primaryId) : undefined;
  }

  getAll(): SelectionItem[] {
    return [...this.selected.values()].map(i => ({ ...i }));
  }

  has(id: string): boolean {
    return this.selected.has(id);
  }

  count(): number {
    return this.selected.size;
  }
}
