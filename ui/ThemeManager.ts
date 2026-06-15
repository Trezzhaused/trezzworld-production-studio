export interface Theme {
  id: string;
  name: string;
  tokens: Record<string, string>;
}

export class ThemeManager {
  private themes = new Map<string, Theme>();
  private activeId?: string;

  register(theme: Theme): void {
    this.themes.set(theme.id, { ...theme, tokens: { ...theme.tokens } });
  }

  activate(id: string): void {
    if (!this.themes.has(id)) throw new Error(`Theme not found: ${id}`);
    this.activeId = id;
  }

  getActive(): Theme | undefined {
    return this.activeId ? this.themes.get(this.activeId) : undefined;
  }

  getToken(key: string): string | undefined {
    return this.getActive()?.tokens[key];
  }

  list(): Theme[] {
    return [...this.themes.values()];
  }
}
