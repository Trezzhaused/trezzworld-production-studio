export interface ProjectSettingsModel {
  projectId: string;
  game?: {
    name?: string;
    description?: string;
    genre?: string;
    maxPlayers?: number;
  };
  build?: {
    outputDir?: string;
    minify?: boolean;
    sourceMaps?: boolean;
  };
  lumi?: {
    enabled?: boolean;
    model?: string;
    maxTokens?: number;
  };
  [key: string]: unknown;
}

export class ProjectSettings {
  constructor(private model: ProjectSettingsModel) {}

  getProjectId(): string { return this.model.projectId; }

  get<T = unknown>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let cur: unknown = this.model;
    for (const k of keys) {
      if (cur === null || typeof cur !== 'object') return defaultValue as T;
      cur = (cur as Record<string, unknown>)[k];
    }
    return (cur === undefined ? defaultValue : cur) as T;
  }

  set(key: string, value: unknown): void {
    const keys = key.split('.');
    let cur: Record<string, unknown> = this.model as unknown as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]] as Record<string, unknown>;
    }
    cur[keys[keys.length - 1]] = value;
  }

  getAll(): ProjectSettingsModel { return JSON.parse(JSON.stringify(this.model)) as ProjectSettingsModel; }

  serialize(): string { return JSON.stringify(this.model, null, 2); }

  static deserialize(json: string): ProjectSettings { return new ProjectSettings(JSON.parse(json)); }

  static defaults(projectId: string): ProjectSettings {
    return new ProjectSettings({
      projectId,
      game: { maxPlayers: 10 },
      build: { outputDir: 'dist', minify: false, sourceMaps: true },
      lumi: { enabled: true },
    });
  }
}
