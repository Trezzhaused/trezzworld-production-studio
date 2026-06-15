export interface CreatorContext {
  creatorId: string;
  universeId?: string;
  placeId?: string;
  displayName?: string;
  connected: boolean;
  lastUpdated: string;
}

export class CreatorSession {
  private context: CreatorContext = {
    creatorId: '',
    connected: false,
    lastUpdated: new Date().toISOString(),
  };

  connect(creatorId: string, displayName?: string): CreatorContext {
    this.context = {
      ...this.context,
      creatorId,
      displayName,
      connected: true,
      lastUpdated: new Date().toISOString(),
    };
    return { ...this.context };
  }

  selectExperience(universeId: string, placeId?: string): CreatorContext {
    this.context = {
      ...this.context,
      universeId,
      placeId,
      lastUpdated: new Date().toISOString(),
    };
    return { ...this.context };
  }

  disconnect(): CreatorContext {
    this.context = {
      ...this.context,
      connected: false,
      lastUpdated: new Date().toISOString(),
    };
    return { ...this.context };
  }

  getContext(): CreatorContext {
    return { ...this.context };
  }
}
