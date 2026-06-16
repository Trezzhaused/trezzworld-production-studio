export interface Place {
  id: string;
  name: string;
  universeId: string;
  isRoot: boolean;
  maxPlayers: number;
  createdAt: string;
  updatedAt: string;
}

export class PlaceManager {
  private readonly places = new Map<string, Place>();

  create(name: string, universeId: string, isRoot = false, maxPlayers = 20): Place {
    const now = new Date().toISOString();
    const place: Place = {
      id: `place-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      universeId,
      isRoot,
      maxPlayers,
      createdAt: now,
      updatedAt: now,
    };
    this.places.set(place.id, place);
    return { ...place };
  }

  update(id: string, updates: Partial<Pick<Place, 'name' | 'maxPlayers'>>): Place {
    const place = this.require(id);
    Object.assign(place, updates, { updatedAt: new Date().toISOString() });
    return { ...place };
  }

  get(id: string): Place | undefined {
    return this.places.get(id);
  }

  listByUniverse(universeId: string): Place[] {
    return [...this.places.values()].filter(p => p.universeId === universeId).map(p => ({ ...p }));
  }

  delete(id: string): boolean {
    return this.places.delete(id);
  }

  private require(id: string): Place {
    const p = this.places.get(id);
    if (!p) throw new Error(`Place not found: ${id}`);
    return p;
  }
}
