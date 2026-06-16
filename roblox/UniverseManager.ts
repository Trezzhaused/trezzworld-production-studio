export interface Universe {
  id: string;
  name: string;
  ownerId: string;
  placeIds: string[];
  createdAt: string;
}

export class UniverseManager {
  private readonly universes = new Map<string, Universe>();

  create(name: string, ownerId: string): Universe {
    const universe: Universe = {
      id: `universe-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      ownerId,
      placeIds: [],
      createdAt: new Date().toISOString(),
    };
    this.universes.set(universe.id, universe);
    return { ...universe };
  }

  addPlace(universeId: string, placeId: string): void {
    const u = this.require(universeId);
    if (!u.placeIds.includes(placeId)) u.placeIds.push(placeId);
  }

  removePlace(universeId: string, placeId: string): void {
    const u = this.require(universeId);
    u.placeIds = u.placeIds.filter(p => p !== placeId);
  }

  get(id: string): Universe | undefined {
    return this.universes.get(id);
  }

  list(): Universe[] {
    return [...this.universes.values()].map(u => ({ ...u, placeIds: [...u.placeIds] }));
  }

  private require(id: string): Universe {
    const u = this.universes.get(id);
    if (!u) throw new Error(`Universe not found: ${id}`);
    return u;
  }
}
