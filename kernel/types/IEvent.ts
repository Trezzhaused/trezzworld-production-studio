export interface IEvent<T = unknown> {
  readonly eventType: string;
  readonly timestamp: string;
  readonly payload: T;
  readonly source?: string;
}
