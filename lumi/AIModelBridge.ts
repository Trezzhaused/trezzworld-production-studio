/**
 * AIModelBridge — TypeScript bridge to the LUMI AI backend.
 *
 * Connects the Electron/React frontend to the Python FastAPI backend's
 * AI pipeline endpoints. Implements the free-first cascade model strategy
 * (mirrors backend/ai_router.py role assignments) for client-side awareness.
 *
 * Endpoints bridged:
 *   POST /api/lumi/chat                  — conversational LUMI interface (OpenRouter + Ollama)
 *   GET  /api/pipeline/{id}/status       — poll pipeline execution status
 *   POST /api/studio/control-plane/boot  — boot a mission (now real execution)
 *   GET  /api/lumi/models                — model cascade info (OpenRouter + Ollama catalogue)
 *   POST /api/lumi/finetune/assemble     — trigger dataset assembly
 *   GET  /api/ollama/status              — local Ollama health + model registry
 *   POST /api/lumi/enhance-prompt        — domain-aware prompt enhancement
 *   POST /api/video/create               — start a video generation job
 *   GET  /api/video/{id}/status          — poll video job
 *   GET  /api/video/{id}/download        — download completed MP4
 *   GET  /api/video/jobs                 — list all video jobs
 */

const API_BASE = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LumiChatResponse {
  role: 'assistant';
  content: string;
  model: string;
  ok: boolean;
}

export interface PipelineJob {
  id: string;
  title: string;
  capability: string;
  status: 'queued' | 'running' | 'done' | 'warn' | 'error';
  workerId: string;
  targetFiles: string[];
  output?: string;
  score?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface MissionStatus {
  id: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  summary: string;
  jobs: PipelineJob[];
  progress: {
    total: number;
    completed: number;
    running: number;
    errored: number;
    percent: number;
  };
}

export interface OllamaModelEntry {
  id: string;
  family: string;
  label: string;
  available: boolean;
}

export interface OllamaStatus {
  available: boolean;
  host: string;
  localModels: Array<{ name: string }>;
  catalogue: OllamaModelEntry[];
  superGemmaReady: boolean;
  installHint: string;
}

export interface VideoJob {
  jobId: string;
  concept: string;
  durationSeconds: number;
  style: string;
  resolution: string;
  fps: number;
  status: 'queued' | 'generating_storyboard' | 'rendering' | 'encoding' | 'done' | 'error';
  progress: number;
  message: string;
  storyboard: Record<string, unknown>;
  outputPath: string | null;
  downloadReady: boolean;
  error: string | null;
  createdAt: number;
}

export interface PromptEnhanceResult {
  domain: string;
  detectedDomain: string;
  enhancedMessages: Array<{ role: string; content: string }>;
  systemPromptPreview: string;
}

export interface MissionBootResult {
  missionId: string;
  objective: string;
  status: 'executing';
  summary: string;
  plannerModel: string;
  executionQueue: Array<{
    jobId: string;
    name: string;
    capability: string;
    workerId: string;
    targetFiles: string[];
    status: string;
    stage: string;
  }>;
}

// ---------------------------------------------------------------------------
// AIModelBridge
// ---------------------------------------------------------------------------

export class AIModelBridge {
  private readonly baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  // ------------------------------------------------------------------
  // LUMI conversational chat
  // ------------------------------------------------------------------

  async chat(
    message: string,
    history: ChatMessage[] = [],
    missionId?: string,
    useOllama = false,
    ollamaModel?: string,
    domain?: string,
  ): Promise<LumiChatResponse> {
    const response = await this._post('/api/lumi/chat', {
      message,
      history,
      missionId: missionId ?? null,
      useOllama,
      ollamaModel: ollamaModel ?? null,
      domain: domain ?? null,
    });
    return response as LumiChatResponse;
  }

  async getChatHistory(missionId?: string, limit = 40): Promise<ChatMessage[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (missionId) params.set('mission_id', missionId);
    const data = await this._get(`/api/lumi/chat/history?${params.toString()}`);
    const raw = (data as { history: Array<{ role: string; content: string }> }).history ?? [];
    return raw.map((h) => ({ role: h.role as ChatMessage['role'], content: h.content }));
  }

  // ------------------------------------------------------------------
  // Mission boot & pipeline execution
  // ------------------------------------------------------------------

  async bootMission(prompt: string): Promise<MissionBootResult> {
    const data = await this._post('/api/studio/control-plane/boot', { prompt });
    return data as MissionBootResult;
  }

  async getPipelineStatus(missionId: string): Promise<MissionStatus> {
    const data = await this._get(`/api/pipeline/${encodeURIComponent(missionId)}/status`);
    return data as MissionStatus;
  }

  async listMissions(): Promise<MissionStatus[]> {
    const data = await this._get('/api/pipeline/missions');
    return ((data as { missions: MissionStatus[] }).missions) ?? [];
  }

  // ------------------------------------------------------------------
  // Model cascade info (OpenRouter + Ollama)
  // ------------------------------------------------------------------

  async getCascadeInfo(): Promise<ModelCascadeEntry[]> {
    const data = await this._get('/api/lumi/models');
    return ((data as { cascade: ModelCascadeEntry[] }).cascade) ?? [];
  }

  async getOllamaStatus(): Promise<OllamaStatus> {
    const data = await this._get('/api/ollama/status');
    return data as OllamaStatus;
  }

  // ------------------------------------------------------------------
  // Prompt enhancement
  // ------------------------------------------------------------------

  async enhancePrompt(prompt: string, domain?: string): Promise<PromptEnhanceResult> {
    const data = await this._post('/api/lumi/enhance-prompt', { prompt, domain: domain ?? null });
    return data as PromptEnhanceResult;
  }

  // ------------------------------------------------------------------
  // Video Creator — end-to-end AI video production
  // ------------------------------------------------------------------

  async createVideo(
    concept: string,
    durationSeconds = 60,
    style = 'cinematic',
    resolution = '1080p',
    fps = 24,
  ): Promise<VideoJob> {
    const data = await this._post('/api/video/create', {
      concept, durationSeconds, style, resolution, fps,
    });
    return data as VideoJob;
  }

  async getVideoStatus(jobId: string): Promise<VideoJob> {
    const data = await this._get(`/api/video/${encodeURIComponent(jobId)}/status`);
    return data as VideoJob;
  }

  async listVideoJobs(): Promise<VideoJob[]> {
    const data = await this._get('/api/video/jobs');
    return ((data as { jobs: VideoJob[] }).jobs) ?? [];
  }

  getVideoDownloadUrl(jobId: string): string {
    return `${this.baseUrl}/api/video/${encodeURIComponent(jobId)}/download`;
  }

  async pollVideoUntilComplete(
    jobId: string,
    onUpdate: (job: VideoJob) => void,
    intervalMs = 3000,
    timeoutMs = 1_200_000,
  ): Promise<VideoJob> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        try {
          const job = await this.getVideoStatus(jobId);
          onUpdate(job);
          if (job.status === 'done' || job.status === 'error') {
            clearInterval(timer);
            resolve(job);
          } else if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            reject(new Error(`Video job ${jobId} timed out`));
          }
        } catch (err) {
          clearInterval(timer);
          reject(err);
        }
      }, intervalMs);
    });
  }

  // ------------------------------------------------------------------
  // Fine-tuning
  // ------------------------------------------------------------------

  async getFineTuneStatus(): Promise<{ ready: boolean; seed_dataset: string | null; datasets: string[] }> {
    const data = await this._get('/api/lumi/finetune/status');
    return data as { ready: boolean; seed_dataset: string | null; datasets: string[] };
  }

  async assembleDataset(): Promise<{ path: string; example_count: number }> {
    const data = await this._post('/api/lumi/finetune/assemble', {});
    return data as { path: string; example_count: number };
  }

  // ------------------------------------------------------------------
  // Poll pipeline until complete (utility for autonomous execution)
  // ------------------------------------------------------------------

  async pollUntilComplete(
    missionId: string,
    onUpdate: (status: MissionStatus) => void,
    intervalMs = 2500,
    timeoutMs = 300_000,
  ): Promise<MissionStatus> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        try {
          const status = await this.getPipelineStatus(missionId);
          onUpdate(status);
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(timer);
            resolve(status);
          } else if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            reject(new Error(`Mission ${missionId} timed out after ${timeoutMs}ms`));
          }
        } catch (err) {
          clearInterval(timer);
          reject(err);
        }
      }, intervalMs);
    });
  }

  // ------------------------------------------------------------------
  // Private HTTP helpers
  // ------------------------------------------------------------------

  private async _get(path: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  }

  private async _post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
  }
}

// Module-level singleton
export const aiModelBridge = new AIModelBridge();
