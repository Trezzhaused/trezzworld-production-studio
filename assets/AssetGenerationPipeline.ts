import { AssetItem } from '../orchestration/ProductionContracts';
import { AnimationGenerator } from './AnimationGenerator';
import { BackgroundGenerator } from './BackgroundGenerator';
import { CharacterGenerator } from './CharacterGenerator';
import { IconGenerator } from './IconGenerator';
import { LogoGenerator } from './LogoGenerator';
import { PropGenerator } from './PropGenerator';
import { TextureGenerator } from './TextureGenerator';
import { UIGenerator } from './UIGenerator';

export class AssetGenerationPipeline {
  private readonly characterGenerator = new CharacterGenerator();
  private readonly backgroundGenerator = new BackgroundGenerator();
  private readonly propGenerator = new PropGenerator();
  private readonly uiGenerator = new UIGenerator();
  private readonly logoGenerator = new LogoGenerator();
  private readonly iconGenerator = new IconGenerator();
  private readonly textureGenerator = new TextureGenerator();
  private readonly animationGenerator = new AnimationGenerator();

  generateAll(projectId: string): AssetItem[] {
    return [
      ...this.characterGenerator.generate(projectId),
      ...this.backgroundGenerator.generate(projectId),
      ...this.propGenerator.generate(projectId),
      ...this.uiGenerator.generate(projectId),
      ...this.logoGenerator.generate(projectId),
      ...this.iconGenerator.generate(projectId),
      ...this.textureGenerator.generate(projectId),
      ...this.animationGenerator.generate(projectId),
    ];
  }
}
