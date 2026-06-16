export interface MediaAsset {
  id: string;
  kind: 'image' | 'model' | 'animation' | 'audio' | 'video';
  path: string;
}

export class AssetComposer {
  compose(assets: MediaAsset[]): MediaAsset[] {
    return assets;
  }
}
