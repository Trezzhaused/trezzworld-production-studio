export interface IService {
  readonly serviceId: string;
  initialize?(): Promise<void>;
  dispose?(): Promise<void>;
}
