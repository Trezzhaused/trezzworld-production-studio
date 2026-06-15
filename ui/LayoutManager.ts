export type LayoutOrientation = 'horizontal' | 'vertical' | 'grid' | 'absolute';

export interface LayoutSpec {
  id: string;
  orientation: LayoutOrientation;
  gap?: number;
  padding?: number;
  children: string[];
}

export class LayoutManager {
  private readonly layouts = new Map<string, LayoutSpec>();

  define(spec: LayoutSpec): void {
    this.layouts.set(spec.id, { ...spec, children: [...spec.children] });
  }

  get(id: string): LayoutSpec | undefined {
    const s = this.layouts.get(id);
    return s ? { ...s, children: [...s.children] } : undefined;
  }

  addChild(layoutId: string, childId: string): void {
    const layout = this.require(layoutId);
    if (!layout.children.includes(childId)) layout.children.push(childId);
  }

  removeChild(layoutId: string, childId: string): void {
    const layout = this.require(layoutId);
    layout.children = layout.children.filter(c => c !== childId);
  }

  list(): LayoutSpec[] {
    return [...this.layouts.values()];
  }

  private require(id: string): LayoutSpec {
    const l = this.layouts.get(id);
    if (!l) throw new Error(`Layout not found: ${id}`);
    return l;
  }
}
