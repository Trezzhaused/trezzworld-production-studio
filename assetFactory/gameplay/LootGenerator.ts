export interface LootGenerationRequest {
  prompt: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  dropRate?: number;
  tableSize?: number;
  robloxCompatible?: boolean;
}

export interface LootGenerationResult {
  success: boolean;
  lootId: string;
  assetPath: string;
  generatedAt: string;
}

export class LootGenerator {
  generate(request: LootGenerationRequest): LootGenerationResult {
    const lootId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      lootId,
      assetPath: `generated/gameplay/loot/${lootId}.json`,
      generatedAt: new Date().toISOString(),
    };
  }
}
