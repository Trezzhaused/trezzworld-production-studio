export interface NPCGenerationRequest {
  prompt: string;
  role?: 'enemy' | 'ally' | 'vendor' | 'quest-giver' | 'boss' | 'neutral';
  faction?: string;
  level?: number;
  robloxCompatible?: boolean;
}

export interface NPCGenerationResult {
  success: boolean;
  npcId: string;
  assetPath: string;
  generatedAt: string;
}

export class NPCGenerator {
  generate(request: NPCGenerationRequest): NPCGenerationResult {
    const npcId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      npcId,
      assetPath: `generated/gameplay/npcs/${npcId}.json`,
      generatedAt: new Date().toISOString(),
    };
  }
}
