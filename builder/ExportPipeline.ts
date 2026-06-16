export type ExportFormat = 'rbxlx' | 'rbxl' | 'zip' | 'json' | 'custom';

export interface ExportOptions {
  format: ExportFormat;
  outputPath: string;
  includeSourceMaps?: boolean;
  minify?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  success: boolean;
  outputPath: string;
  format: ExportFormat;
  sizeBytes?: number;
  durationMs: number;
  error?: string;
}

type ExportHandler = (options: ExportOptions) => Promise<Omit<ExportResult, 'durationMs'>>;

export class ExportPipeline {
  private readonly handlers = new Map<ExportFormat, ExportHandler>();

  registerHandler(format: ExportFormat, handler: ExportHandler): void {
    this.handlers.set(format, handler);
  }

  async export(options: ExportOptions): Promise<ExportResult> {
    const start = Date.now();
    const handler = this.handlers.get(options.format);
    if (!handler) {
      return {
        success: false,
        outputPath: options.outputPath,
        format: options.format,
        durationMs: 0,
        error: `No handler registered for format: ${options.format}`,
      };
    }
    try {
      const result = await handler(options);
      return { ...result, durationMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        outputPath: options.outputPath,
        format: options.format,
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }

  supportedFormats(): ExportFormat[] { return [...this.handlers.keys()]; }
}
