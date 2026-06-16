export interface AbilityGenerationRequest {
  prompt: string;
  category?: 'active' | 'passive' | 'ultimate' | 'toggle';
  element?: 'fire' | 'ice' | 'lightning' | 'earth' | 'arcane' | 'physical';
  cooldownSeconds?: number;
  robloxCompatible?: boolean;
}

export interface AbilityGenerationResult {
  success: boolean;
  abilityId: string;
  assetPath: string;
  generatedAt: string;
}

export class AbilityGenerator {
  generate(request: AbilityGenerationRequest): AbilityGenerationResult {
    const abilityId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      abilityId,
      assetPath: `generated/gameplay/abilities/${abilityId}.json`,
      generatedAt: new Date().toISOString(),
    };
  }
}
