export interface Package {
  id: string;
  name: string;
  version: string;
  assetIds: string[];
  builtAt: string;
  outputPath: string;
}

export class PackageBuilder {
  private readonly packages = new Map<string, Package>();

  build(name: string, version: string, assetIds: string[]): Package {
    const pkg: Package = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      version,
      assetIds: [...assetIds],
      builtAt: new Date().toISOString(),
      outputPath: `dist/packages/${name}-${version}.rbxm`,
    };
    this.packages.set(pkg.id, pkg);
    return { ...pkg };
  }

  get(id: string): Package | undefined {
    return this.packages.get(id);
  }

  list(): Package[] {
    return [...this.packages.values()].map(p => ({ ...p }));
  }
}
