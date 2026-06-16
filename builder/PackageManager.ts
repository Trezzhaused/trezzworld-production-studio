export interface Package {
  name: string;
  version: string;
  resolvedPath?: string;
  dependencies?: string[];
}

export class PackageManager {
  private readonly packages = new Map<string, Package>();

  install(pkg: Package): void {
    this.packages.set(pkg.name, pkg);
  }

  uninstall(name: string): boolean { return this.packages.delete(name); }

  get(name: string): Package | undefined { return this.packages.get(name); }

  list(): Package[] { return [...this.packages.values()]; }

  isInstalled(name: string): boolean { return this.packages.has(name); }

  resolve(name: string): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visit = (n: string) => {
      if (visited.has(n)) return;
      visited.add(n);
      const pkg = this.packages.get(n);
      if (!pkg) throw new Error(`Package not installed: ${n}`);
      for (const d of pkg.dependencies ?? []) visit(d);
      order.push(n);
    };
    visit(name);
    return order;
  }
}
