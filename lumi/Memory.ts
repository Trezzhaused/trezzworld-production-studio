export interface MemoryEntry {
  id: string;
  type: 'goal' | 'task' | 'context' | 'knowledge' | 'artifact';
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface MemorySnapshot {
  entries: MemoryEntry[];
  createdAt: string;
}

export class Memory {
  private readonly store = new Map<string, MemoryEntry>();

  put(entry: Omit<MemoryEntry,'createdAt'|'updatedAt'>): MemoryEntry {
    const now=new Date().toISOString();
    const item: MemoryEntry={...entry,createdAt:now,updatedAt:now};
    this.store.set(item.id,item);
    return item;
  }

  get(id:string){return this.store.get(id);}
  findByTag(tag:string){return [...this.store.values()].filter(e=>e.tags.includes(tag));}
  findByType(type:MemoryEntry['type']){return [...this.store.values()].filter(e=>e.type===type);}
  update(id:string,value:unknown){const e=this.store.get(id); if(!e) return undefined; e.value=value; e.updatedAt=new Date().toISOString(); this.store.set(id,e); return e;}
  remove(id:string){return this.store.delete(id);}
  snapshot():MemorySnapshot{return{entries:[...this.store.values()],createdAt:new Date().toISOString()};}
  clear(){this.store.clear();}
}
