export interface ArchitectureModule {
  id: string;
  layer: string;
  dependencies: string[];
  lifetime?: 'singleton' | 'scoped' | 'transient';
}

export interface ArchitectureViolation {
  rule: 'layer-violation' | 'circular-dependency' | 'unused-service' | 'invalid-lifetime';
  message: string;
}

export interface ArchitectureValidationResult {
  valid: boolean;
  violations: ArchitectureViolation[];
  validatedAt: string;
}

export class ArchitectureValidator {
  validate(modules: ArchitectureModule[]): ArchitectureValidationResult {
    const violations: ArchitectureViolation[] = [];
    const layerOrder = new Map<string, number>([
      ['presentation', 1],
      ['application', 2],
      ['domain', 3],
      ['infrastructure', 4],
    ]);

    const moduleById = new Map(modules.map((module) => [module.id, module]));

    for (const module of modules) {
      for (const dependencyId of module.dependencies) {
        const dependency = moduleById.get(dependencyId);
        if (!dependency) {
          continue;
        }
        const fromRank = layerOrder.get(module.layer);
        const toRank = layerOrder.get(dependency.layer);
        if (fromRank !== undefined && toRank !== undefined && toRank > fromRank) {
          violations.push({
            rule: 'layer-violation',
            message: `${module.id} (${module.layer}) depends on lower-level policy ${dependency.id} (${dependency.layer}).`,
          });
        }
      }
    }

    if (this.hasCycle(modules)) {
      violations.push({
        rule: 'circular-dependency',
        message: 'Circular dependency detected in module graph.',
      });
    }

    const referenced = new Set(modules.flatMap((module) => module.dependencies));
    modules
      .filter((module) => !referenced.has(module.id) && module.layer !== 'presentation')
      .forEach((module) => {
        violations.push({
          rule: 'unused-service',
          message: `${module.id} is not referenced by other modules.`,
        });
      });

    modules
      .filter((module) => module.layer === 'domain' && module.lifetime === 'transient')
      .forEach((module) => {
        violations.push({
          rule: 'invalid-lifetime',
          message: `${module.id} in domain layer should not be transient.`,
        });
      });

    return {
      valid: violations.length === 0,
      violations,
      validatedAt: new Date().toISOString(),
    };
  }

  private hasCycle(modules: ArchitectureModule[]): boolean {
    const moduleById = new Map(modules.map((module) => [module.id, module]));
    const visited = new Set<string>();
    const active = new Set<string>();

    const visit = (id: string): boolean => {
      if (active.has(id)) {
        return true;
      }
      if (visited.has(id)) {
        return false;
      }
      visited.add(id);
      active.add(id);

      const module = moduleById.get(id);
      if (!module) {
        active.delete(id);
        return false;
      }

      for (const dependencyId of module.dependencies) {
        if (visit(dependencyId)) {
          return true;
        }
      }

      active.delete(id);
      return false;
    };

    return modules.some((module) => visit(module.id));
  }
}
