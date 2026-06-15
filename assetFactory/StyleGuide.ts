export interface StyleProfile {
  name: string;
  colorPalette: string[];
  typography?: string;
  theme?: string;
  assetOverrides?: Record<string,string>;
  version: string;
}

export class StyleGuide {
  private profiles = new Map<string, StyleProfile>();

  register(profile: StyleProfile): void {
    this.profiles.set(profile.name, { ...profile, colorPalette: [...profile.colorPalette], assetOverrides: profile.assetOverrides ? { ...profile.assetOverrides } : undefined });
  }

  get(name: string): StyleProfile | undefined {
    const p = this.profiles.get(name);
    return p ? { ...p, colorPalette: [...p.colorPalette], assetOverrides: p.assetOverrides ? { ...p.assetOverrides } : undefined } : undefined;
  }

  list(): StyleProfile[] {
    return Array.from(this.profiles.values()).map(p => ({ ...p, colorPalette: [...p.colorPalette], assetOverrides: p.assetOverrides ? { ...p.assetOverrides } : undefined }));
  }
}
