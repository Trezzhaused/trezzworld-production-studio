export interface NPCSpawnRequest {
  prompt: string;
  npcType?: 'enemy' | 'friendly' | 'vendor' | 'quest-giver' | 'ambient';
  count?: number;
  spawnRadius?: number;
  robloxCompatible?: boolean;
}

export interface NPCSpawnResult {
  success: boolean;
  spawnId: string;
  assetPath: string;
  generatedAt: string;
}

export class NPCSpawner {
  spawn(request: NPCSpawnRequest): NPCSpawnResult {
    const spawnId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      spawnId,
      assetPath: `generated/npcs/${spawnId}.rbxm`,
      generatedAt: new Date().toISOString(),
    };
  }
}
