export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  files: Array<{ path: string; content: string }>;
  settings?: Record<string, unknown>;
}

export class TemplateManager {
  private readonly templates = new Map<string, ProjectTemplate>();

  register(template: ProjectTemplate): void {
    if (this.templates.has(template.id)) throw new Error(`Template already registered: ${template.id}`);
    this.templates.set(template.id, template);
  }

  get(id: string): ProjectTemplate | undefined { return this.templates.get(id); }

  list(): ProjectTemplate[] { return [...this.templates.values()]; }

  remove(id: string): boolean { return this.templates.delete(id); }

  instantiate(
    templateId: string,
    overrides?: Partial<Pick<ProjectTemplate, 'name' | 'description'>>,
  ): ProjectTemplate {
    const t = this.templates.get(templateId);
    if (!t) throw new Error(`Template not found: ${templateId}`);
    return { ...t, files: t.files.map(f => ({ ...f })), ...overrides };
  }

  search(query: string): ProjectTemplate[] {
    const q = query.toLowerCase();
    return this.list().filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.tags ?? []).some(tag => tag.toLowerCase().includes(q)),
    );
  }
}
