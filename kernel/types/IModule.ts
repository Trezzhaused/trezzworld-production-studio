export interface IModule {
  readonly moduleId: string;
  readonly version: string;
  dependencies?: string[];
  initialize(container: unknown): Promise<void>;
  dispose?(): Promise<void>;
}
