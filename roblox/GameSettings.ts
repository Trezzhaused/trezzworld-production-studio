export interface GameSettings {
  universeId: string;
  maxPlayers: number;
  allowCopying: boolean;
  genre: string;
  isPublic: boolean;
  enableStudio: boolean;
  serverFillType: 'empty' | 'balanced' | 'full';
  customSettings: Record<string, unknown>;
}

export class GameSettingsManager {
  private settings = new Map<string, GameSettings>();

  configure(universeId: string, settings: Partial<Omit<GameSettings, 'universeId'>>): GameSettings {
    const existing = this.settings.get(universeId) ?? {
      universeId,
      maxPlayers: 20,
      allowCopying: false,
      genre: 'all',
      isPublic: false,
      enableStudio: true,
      serverFillType: 'balanced' as const,
      customSettings: {},
    };
    const updated = { ...existing, ...settings, universeId };
    this.settings.set(universeId, updated);
    return { ...updated };
  }

  get(universeId: string): GameSettings | undefined {
    return this.settings.get(universeId);
  }

  setCustom(universeId: string, key: string, value: unknown): void {
    const s = this.settings.get(universeId);
    if (!s) throw new Error(`Game settings not found for universe: ${universeId}`);
    s.customSettings[key] = value;
  }
}
