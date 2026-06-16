export interface ExperienceConfig {
  name: string;
  genre: string;
  maxPlayers: number;
  isPublic: boolean;
  description?: string;
}

export interface Experience {
  id: string;
  config: ExperienceConfig;
  createdAt: string;
  status: 'draft' | 'building' | 'ready';
}

export class ExperienceBuilder {
  private readonly experiences = new Map<string, Experience>();

  create(config: ExperienceConfig): Experience {
    const experience: Experience = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      config: { ...config },
      createdAt: new Date().toISOString(),
      status: 'draft',
    };
    this.experiences.set(experience.id, experience);
    return { ...experience };
  }

  build(id: string): Experience {
    const exp = this.require(id);
    exp.status = 'building';
    setTimeout(() => { exp.status = 'ready'; }, 0);
    return { ...exp };
  }

  get(id: string): Experience | undefined {
    return this.experiences.get(id);
  }

  list(): Experience[] {
    return [...this.experiences.values()].map(e => ({ ...e }));
  }

  private require(id: string): Experience {
    const e = this.experiences.get(id);
    if (!e) throw new Error(`Experience not found: ${id}`);
    return e;
  }
}
