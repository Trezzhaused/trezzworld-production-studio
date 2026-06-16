export interface ProjectFile {
  path: string;
  type: string;
  sizeBytes?: number;
  lastModified?: string;
}

export interface ProjectModel {
  id: string;
  name: string;
  path: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  files?: ProjectFile[];
  metadata?: Record<string, unknown>;
}

export class Project {
  constructor(private model: ProjectModel) {}

  getId(): string { return this.model.id; }
  getName(): string { return this.model.name; }
  getPath(): string { return this.model.path; }

  update(fields: Partial<Pick<ProjectModel, 'name' | 'description' | 'tags' | 'metadata'>>): void {
    Object.assign(this.model, fields, { updatedAt: new Date().toISOString() });
  }

  addFile(file: ProjectFile): void {
    if (!this.model.files) this.model.files = [];
    this.model.files.push(file);
    this.model.updatedAt = new Date().toISOString();
  }

  removeFile(path: string): boolean {
    const before = this.model.files?.length ?? 0;
    this.model.files = (this.model.files ?? []).filter(f => f.path !== path);
    return (this.model.files?.length ?? 0) !== before;
  }

  getModel(): ProjectModel {
    return { ...this.model, files: this.model.files ? [...this.model.files] : [] };
  }

  serialize(): string { return JSON.stringify(this.model, null, 2); }

  static deserialize(json: string): Project { return new Project(JSON.parse(json)); }

  static create(name: string, path: string, metadata?: Record<string, unknown>): Project {
    const now = new Date().toISOString();
    return new Project({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, path,
      createdAt: now, updatedAt: now,
      metadata,
    });
  }
}
