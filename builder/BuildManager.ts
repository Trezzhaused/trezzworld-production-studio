import { Compiler, CompileInput, CompileResult } from './Compiler';
import { IncrementalBuilder } from './IncrementalBuilder';
import { ArtifactManager, Artifact } from './ArtifactManager';
import { DependencyResolver } from './DependencyResolver';
import { Manifest } from './Manifest';
import { ExportPipeline, ExportOptions, ExportResult } from './ExportPipeline';

export type BuildStatus = 'idle' | 'building' | 'success' | 'failed';

export interface BuildResult {
  buildId: string;
  status: BuildStatus;
  artifacts: Artifact[];
  compileResults: CompileResult[];
  durationMs: number;
  error?: string;
}

export class BuildManager {
  readonly compiler = new Compiler();
  readonly incremental = new IncrementalBuilder();
  readonly artifacts = new ArtifactManager();
  readonly deps = new DependencyResolver();
  readonly exports = new ExportPipeline();

  private manifest?: Manifest;
  private status: BuildStatus = 'idle';

  getStatus(): BuildStatus { return this.status; }
  getManifest(): Manifest | undefined { return this.manifest; }

  async build(projectId: string, inputs: CompileInput[]): Promise<BuildResult> {
    const buildId = `build-${Date.now()}`;
    const start = Date.now();
    this.status = 'building';
    this.manifest = Manifest.create(projectId, buildId);
    try {
      const compileResults = await this.compiler.compileAll(inputs);
      const failed = compileResults.filter(r => !r.success);
      if (failed.length > 0) {
        this.status = 'failed';
        return {
          buildId, status: 'failed', artifacts: [], compileResults,
          durationMs: Date.now() - start,
          error: `${failed.length} compile error(s)`,
        };
      }
      const storedArtifacts: Artifact[] = [];
      for (const r of compileResults) {
        const artifact: Artifact = {
          id: r.id, name: r.id, type: 'script', path: r.id,
          createdAt: new Date().toISOString(), buildId,
        };
        this.artifacts.store(artifact);
        storedArtifacts.push(artifact);
        this.manifest.addEntry({ id: r.id, name: r.id, version: '1', type: 'script', path: r.id });
      }
      this.incremental.clearDirty();
      this.status = 'success';
      return { buildId, status: 'success', artifacts: storedArtifacts, compileResults, durationMs: Date.now() - start };
    } catch (err) {
      this.status = 'failed';
      return {
        buildId, status: 'failed', artifacts: [], compileResults: [],
        durationMs: Date.now() - start, error: (err as Error).message,
      };
    }
  }

  async exportBuild(options: ExportOptions): Promise<ExportResult> {
    return this.exports.export(options);
  }
}
