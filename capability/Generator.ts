export interface Generator<TInput, TOutput> {
  readonly id: string;
  canHandle(input: TInput): boolean;
  generate(input: TInput): Promise<TOutput>;
}
