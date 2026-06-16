export interface PackageBuildRequest {
  worldId: string;
  version?: string;
  includeAssets?: string[];
  robloxCompatible?: boolean;
}

export interface PackageBuildResult {
  success: boolean;
  packageId: string;
  assetPath: string;
  generatedAt: string;
}

export class PackageBuilder {
  build(request: PackageBuildRequest): PackageBuildResult {
    const packageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      success: true,
      packageId,
      assetPath: `generated/publishing/packages/${packageId}.zip`,
      generatedAt: new Date().toISOString(),
    };
  }
}
