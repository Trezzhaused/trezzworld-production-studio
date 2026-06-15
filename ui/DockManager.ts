export type DockPosition = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface DockPanel {
  id: string;
  title: string;
  position: DockPosition;
  size: number;
  visible: boolean;
}

export class DockManager {
  private readonly panels = new Map<string, DockPanel>();

  add(id: string, title: string, position: DockPosition, size = 250): DockPanel {
    const panel: DockPanel = { id, title, position, size, visible: true };
    this.panels.set(id, panel);
    return { ...panel };
  }

  remove(id: string): boolean {
    return this.panels.delete(id);
  }

  show(id: string): void { this.require(id).visible = true; }
  hide(id: string): void { this.require(id).visible = false; }
  toggle(id: string): void {
    const p = this.require(id);
    p.visible = !p.visible;
  }

  resize(id: string, size: number): void {
    this.require(id).size = size;
  }

  move(id: string, position: DockPosition): void {
    this.require(id).position = position;
  }

  getByPosition(position: DockPosition): DockPanel[] {
    return [...this.panels.values()].filter(p => p.position === position).map(p => ({ ...p }));
  }

  list(): DockPanel[] {
    return [...this.panels.values()].map(p => ({ ...p }));
  }

  private require(id: string): DockPanel {
    const p = this.panels.get(id);
    if (!p) throw new Error(`Dock panel not found: ${id}`);
    return p;
  }
}
