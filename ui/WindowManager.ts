export interface WindowSpec {
  id: string;
  title: string;
  width: number;
  height: number;
  x: number;
  y: number;
  visible: boolean;
  minimized: boolean;
}

export class WindowManager {
  private readonly windows = new Map<string, WindowSpec>();

  open(id: string, title: string, width = 800, height = 600, x = 0, y = 0): WindowSpec {
    const win: WindowSpec = { id, title, width, height, x, y, visible: true, minimized: false };
    this.windows.set(id, win);
    return { ...win };
  }

  close(id: string): void {
    this.windows.delete(id);
  }

  show(id: string): void { this.require(id).visible = true; }
  hide(id: string): void { this.require(id).visible = false; }
  minimize(id: string): void { this.require(id).minimized = true; }
  restore(id: string): void { this.require(id).minimized = false; }

  move(id: string, x: number, y: number): void {
    const win = this.require(id);
    win.x = x;
    win.y = y;
  }

  resize(id: string, width: number, height: number): void {
    const win = this.require(id);
    win.width = width;
    win.height = height;
  }

  get(id: string): WindowSpec | undefined {
    const w = this.windows.get(id);
    return w ? { ...w } : undefined;
  }

  list(): WindowSpec[] {
    return [...this.windows.values()].map(w => ({ ...w }));
  }

  private require(id: string): WindowSpec {
    const w = this.windows.get(id);
    if (!w) throw new Error(`Window not found: ${id}`);
    return w;
  }
}
