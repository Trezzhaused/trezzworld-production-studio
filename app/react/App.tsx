import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BackendStatus { status: string; version: string; }
interface ReadinessCheck { category: string; goal: string; passed: boolean; }
interface ProductionReadiness { score: number; checks: ReadinessCheck[]; }
interface MetaDevelopmentPhase { id: string; name: string; status: 'active' | 'in-progress' | 'planned'; }
interface RepositoryIntelligenceSummary { sourceFiles: number; todoMarkers: number; architectureDetected: boolean; missingTestScript: boolean; }
interface MetaDevelopmentStatus { highestRoiNextMove: string; currentReality: string[]; repositoryIntelligence: RepositoryIntelligenceSummary; phases: MetaDevelopmentPhase[]; productionReadiness: ProductionReadiness; }
interface MetaBuilderAction { id: string; title: string; objective: string; targetFiles: string[]; }
interface MetaBuilderGap { phaseId: string; phaseName: string; priority: number; missingFiles: string[]; }
interface TodoHotspot { path: string; markers: number; }
interface MetaBuilderStatus { summary: string; readinessEstimate: number; nextActions: MetaBuilderAction[]; phaseGaps: MetaBuilderGap[]; todoHotspots: TodoHotspot[]; }
interface WorkspaceModule { id: string; name: string; status: 'active' | 'in-progress' | 'planned'; description: string; }
interface CapabilityProvider { capability: string; providerId: string; providerKind: string; status: string; route: string; }
interface QueueItem { jobId: string; actionId?: string; name: string; workerId: string; status: string; stage: string; targetFiles: string[]; score?: number; error?: string; }
interface DeliverySurface { name: string; status: 'active' | 'in-progress' | 'planned'; }
interface ControlPlaneStatus { workspaceTitle: string; finishLine: string; missionPromptPlaceholder: string; workspaceModules: WorkspaceModule[]; capabilityProviders: CapabilityProvider[]; executionQueue: QueueItem[]; deliverySurfaces: DeliverySurface[]; productionReadiness: ProductionReadiness; metaBuilder: { summary: string; readinessEstimate: number; nextActions: MetaBuilderAction[]; }; }
interface MissionBootResult { objective: string; missionId?: string; status: string; approvalRequired: boolean; summary: string; plannerModel?: string; requestedCapabilities: CapabilityProvider[]; executionQueue: QueueItem[]; executionPlan: string[]; selectedActions: MetaBuilderAction[]; }
interface PipelineProgress { total: number; completed: number; running: number; errored: number; percent: number; }
interface PipelineStatus { id: string; status: string; summary: string; jobs: QueueItem[]; progress: PipelineProgress; }
interface ChatMessage { role: 'user' | 'assistant'; content: string; model?: string; }
interface PersistedChatMessage { role: string; content: string; model_used?: string; }
interface ChatHistoryResponse { history: PersistedChatMessage[]; }
interface MissionSummary { id: string; prompt: string; status: string; created_at: string; updated_at: string; summary: string; }
interface MissionListResponse { missions: MissionSummary[]; }
interface OllamaModel { id: string; family: string; label: string; available: boolean; }
interface OllamaStatus { available: boolean; host: string; localModels: Array<{ name: string }>; catalogue: OllamaModel[]; superGemmaReady: boolean; installHint: string; }
interface VideoStoryboardScene { id: string; title: string; duration_seconds: number; visual_description: string; text_overlay?: string; transition_in: string; transition_out: string; camera_motion: string; color_grade: string; }
interface VideoStoryboard { title?: string; logline?: string; style?: string; total_duration_seconds?: number; color_palette?: string[]; audio?: Record<string, unknown>; scenes?: VideoStoryboardScene[]; }
interface VideoJob { jobId: string; concept: string; durationSeconds: number; style: string; resolution: string; fps: number; status: string; progress: number; message: string; storyboard: VideoStoryboard; outputPath: string | null; downloadReady: boolean; error: string | null; createdAt: number; }
interface MusicJob { jobId: string; concept: string; genre: string; bpm: number; mood: string; durationSeconds: number; status: string; progress: number; message: string; outputPath: string | null; outputFormat: string | null; compositionBrief: string; provider: string; downloadReady: boolean; error: string | null; createdAt: number; }
interface VideoJobsResponse { jobs: VideoJob[]; }
interface MusicJobsResponse { jobs: MusicJob[]; }
interface ImageRenderResult { ok: boolean; provider: string; model: string; imageBase64: string | null; format: string | null; message: string; }
interface UserKeyEntry { provider: string; name: string; description: string; cost: string; get_key_url: string; recommended: boolean; configured: boolean; key_preview?: string; added_at?: string; }
interface UserKeysResponse { providers: UserKeyEntry[]; configured_count: number; }

interface ThemeTokens {
  bg: string;
  bgRadial: string;
  panel: string;
  panelAlt: string;
  panelSoft: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accent2: string;
  accent3: string;
  accentGradient: string;
  success: string;
  warning: string;
  danger: string;
  input: string;
  shadow: string;
}

type Tab = 'home' | 'music' | 'video' | 'image' | 'chat' | 'code' | 'settings';
type MusicSubTab = 'musicvideo' | 'audio';

type CreativeTemplate = {
  id: string;
  title: string;
  description: string;
  badge: string;
  duration?: number;
  style?: string;
  tags: string[];
  artwork: string;
  actionLabel: string;
  apply: () => void;
};

type StockAsset = {
  id: string;
  kind: 'video' | 'image' | 'music';
  title: string;
  description: string;
  tags: string[];
  artwork: string;
  actionLabel: string;
  apply: () => void;
};

const API = (window.location.port === '5173' || window.location.port === '3000') ? 'http://localhost:8000' : '';

const dark: ThemeTokens = {
  bg: '#050816',
  bgRadial: 'radial-gradient(circle at top left, rgba(73,92,255,0.18), transparent 35%), radial-gradient(circle at top right, rgba(56,189,248,0.12), transparent 24%), #050816',
  panel: 'rgba(10, 16, 34, 0.88)',
  panelAlt: 'rgba(16, 23, 46, 0.96)',
  panelSoft: 'rgba(255,255,255,0.04)',
  border: 'rgba(148, 163, 184, 0.16)',
  borderStrong: 'rgba(96, 165, 250, 0.25)',
  text: '#eef2ff',
  textMuted: '#a8b3cf',
  textSoft: '#7280a7',
  accent: '#7c5cff',
  accent2: '#38bdf8',
  accent3: '#f472b6',
  accentGradient: 'linear-gradient(135deg, #7c5cff 0%, #38bdf8 52%, #22d3ee 100%)',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  input: 'rgba(8, 14, 28, 0.96)',
  shadow: '0 28px 60px rgba(0, 0, 0, 0.35)',
};

const light: ThemeTokens = {
  bg: '#f4f7fb',
  bgRadial: 'radial-gradient(circle at top left, rgba(124,92,255,0.14), transparent 35%), radial-gradient(circle at top right, rgba(56,189,248,0.12), transparent 24%), #f4f7fb',
  panel: 'rgba(255, 255, 255, 0.92)',
  panelAlt: 'rgba(255, 255, 255, 0.98)',
  panelSoft: 'rgba(15,23,42,0.04)',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(76, 103, 240, 0.22)',
  text: '#0f172a',
  textMuted: '#475569',
  textSoft: '#94a3b8',
  accent: '#6d4dff',
  accent2: '#0284c7',
  accent3: '#ec4899',
  accentGradient: 'linear-gradient(135deg, #6d4dff 0%, #06b6d4 100%)',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  input: '#f8fafc',
  shadow: '0 24px 48px rgba(15, 23, 42, 0.08)',
};

const NAV_ITEMS: Array<{ id: Tab; icon: string; label: string; caption: string }> = [
  { id: 'home', icon: '✦', label: 'Studio', caption: 'Mission control' },
  { id: 'video', icon: '🎬', label: 'Video', caption: 'Runway-style editor' },
  { id: 'music', icon: '♫', label: 'Music', caption: 'Audio + music videos' },
  { id: 'image', icon: '◫', label: 'Images', caption: 'Render + prompts' },
  { id: 'chat', icon: '💬', label: 'LUMI', caption: 'AI copilot' },
  { id: 'code', icon: '⌘', label: 'Code', caption: 'Build + docs' },
  { id: 'settings', icon: '⚙', label: 'Settings', caption: 'Providers + keys' },
];

const VIDEO_STYLE_OPTIONS = ['cinematic', 'documentary', 'music video', 'game trailer', 'corporate', 'animated', 'lo-fi aesthetic', 'epic fantasy'];
const IMAGE_STYLE_OPTIONS = ['photorealistic', 'cinematic', 'digital art', 'anime', '3d render', 'oil painting', 'watercolor', 'comic book', 'pixel art'];
const CODE_LANGUAGES = ['typescript', 'python', 'javascript', 'lua', 'csharp', 'gdscript', 'html/css', 'sql', 'bash', 'rust', 'go', 'swift', 'kotlin', 'markdown'];

const SHELL_CSS = `
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; }
  button, input, textarea, select { font: inherit; }
  .studio-shell { display: grid; grid-template-columns: 280px minmax(0, 1fr); min-height: 100vh; }
  .studio-sidebar { position: sticky; top: 0; height: 100vh; overflow: auto; }
  .studio-main { min-width: 0; }
  .studio-grid-2 { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr); gap: 18px; }
  .studio-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .studio-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .studio-list { display: grid; gap: 12px; }
  .studio-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
  .studio-scroll::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.22); border-radius: 999px; }
  .studio-scroll::-webkit-scrollbar-track { background: transparent; }
  .card-hover { transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
  .card-hover:hover { transform: translateY(-2px); }
  @media (max-width: 1240px) {
    .studio-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .studio-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 980px) {
    .studio-shell { grid-template-columns: 1fr; }
    .studio-sidebar { position: relative; height: auto; }
    .studio-grid-2, .studio-grid-3, .studio-grid-4 { grid-template-columns: 1fr; }
  }
`;

const fmtDur = (seconds: number) => seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60 ? `${seconds % 60}s` : ''}`.trim() : `${seconds}s`;
const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<T>;
};
const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<T>;
};
const truncate = (value: string, max = 110) => value.length > max ? `${value.slice(0, max)}…` : value;
const copyText = async (value: string) => {
  try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
};
const downloadTextFile = (content: string, filename: string) => {
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  anchor.download = filename;
  anchor.click();
};
const makeArtwork = (title: string, subtitle: string, start: string, end: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${start}" offset="0%"/><stop stop-color="${end}" offset="100%"/></linearGradient></defs><rect width="1200" height="720" rx="42" fill="url(#g)"/><rect x="32" y="32" width="1136" height="656" rx="30" fill="rgba(5,10,24,.18)" stroke="rgba(255,255,255,.18)"/><circle cx="1036" cy="148" r="140" fill="rgba(255,255,255,.08)"/><circle cx="178" cy="550" r="220" fill="rgba(255,255,255,.08)"/><text x="86" y="182" fill="white" font-family="Inter,Arial,sans-serif" font-size="30" opacity="0.88">TrezzWorld Studio</text><text x="86" y="350" fill="white" font-family="Inter,Arial,sans-serif" font-size="76" font-weight="700">${title.replace(/&/g, '&amp;')}</text><text x="86" y="424" fill="rgba(255,255,255,.88)" font-family="Inter,Arial,sans-serif" font-size="32">${subtitle.replace(/&/g, '&amp;')}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

function panelStyle(T: ThemeTokens, extra?: CSSProperties): CSSProperties {
  return {
    background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 24,
    boxShadow: T.shadow,
    backdropFilter: 'blur(18px)',
    ...extra,
  };
}

function inputStyle(T: ThemeTokens, extra?: CSSProperties): CSSProperties {
  return {
    width: '100%',
    borderRadius: 16,
    border: `1px solid ${T.border}`,
    background: T.input,
    color: T.text,
    padding: '14px 16px',
    outline: 'none',
    ...extra,
  };
}

function buttonStyle(T: ThemeTokens, variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary', disabled = false): CSSProperties {
  const background = variant === 'primary'
    ? T.accentGradient
    : variant === 'secondary'
      ? T.panelSoft
      : variant === 'danger'
        ? T.danger
        : 'transparent';
  return {
    borderRadius: 16,
    border: variant === 'ghost' ? `1px solid ${T.border}` : variant === 'secondary' ? `1px solid ${T.borderStrong}` : 'none',
    background,
    color: variant === 'ghost' ? T.textMuted : '#fff',
    padding: '12px 16px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}

function badgeStyle(T: ThemeTokens, value: string): CSSProperties {
  const normalized = value.toLowerCase();
  const color = normalized.includes('error') || normalized.includes('fail') ? T.danger : normalized.includes('run') || normalized.includes('active') || normalized.includes('ready') || normalized.includes('done') ? T.success : normalized.includes('plan') || normalized.includes('progress') || normalized.includes('pending') ? T.warning : T.accent2;
  return {
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color,
    background: `${color}22`,
    border: `1px solid ${color}33`,
  };
}

function sectionTitleStyle(T: ThemeTokens): CSSProperties {
  return { margin: 0, fontSize: 18, fontWeight: 800, color: T.text };
}

function ProgressBar({ pct, status, T }: { pct: number; status: string; T: ThemeTokens }) {
  const color = status === 'done' || status === 'completed' ? T.success : status === 'error' || status === 'failed' ? T.danger : T.accent2;
  return (
    <div style={{ height: 8, background: T.panelSoft, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .3s ease' }} />
    </div>
  );
}

function MetricCard({ T, label, value, hint }: { T: ThemeTokens; label: string; value: string; hint: string }) {
  return (
    <div className="card-hover" style={panelStyle(T, { padding: 18 })}>
      <div style={{ color: T.textSoft, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: T.text, marginBottom: 6 }}>{value}</div>
      <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function TemplateCard({ T, template }: { T: ThemeTokens; template: CreativeTemplate }) {
  return (
    <div className="card-hover" style={panelStyle(T, { padding: 14, overflow: 'hidden' })}>
      <img src={template.artwork} alt={template.title} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 18, marginBottom: 14, border: `1px solid ${T.border}` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div>
          <div style={{ color: T.accent2, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{template.badge}</div>
          <h3 style={{ margin: 0, color: T.text, fontSize: 16 }}>{template.title}</h3>
        </div>
        {template.duration ? <span style={badgeStyle(T, `${template.duration}s`)}>{fmtDur(template.duration)}</span> : null}
      </div>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, margin: '10px 0 12px' }}>{template.description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {template.tags.map(tag => <span key={tag} style={{ ...badgeStyle(T, 'tag'), fontSize: 10, padding: '5px 8px', color: T.textMuted }}>{tag}</span>)}
      </div>
      <button onClick={template.apply} style={{ ...buttonStyle(T, 'secondary'), width: '100%' }}>{template.actionLabel}</button>
    </div>
  );
}

function AssetCard({ T, asset }: { T: ThemeTokens; asset: StockAsset }) {
  return (
    <div className="card-hover" style={panelStyle(T, { padding: 12, overflow: 'hidden' })}>
      <img src={asset.artwork} alt={asset.title} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 16, marginBottom: 12, border: `1px solid ${T.border}` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <strong style={{ color: T.text, fontSize: 14 }}>{asset.title}</strong>
        <span style={badgeStyle(T, asset.kind)}>{asset.kind}</span>
      </div>
      <p style={{ color: T.textMuted, fontSize: 12, lineHeight: 1.6, margin: '8px 0 10px' }}>{asset.description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {asset.tags.map(tag => <span key={tag} style={{ ...badgeStyle(T, 'tag'), fontSize: 10, padding: '4px 8px', color: T.textMuted }}>{tag}</span>)}
      </div>
      <button onClick={asset.apply} style={{ ...buttonStyle(T, 'ghost'), width: '100%' }}>{asset.actionLabel}</button>
    </div>
  );
}

function QueueList({ T, items }: { T: ThemeTokens; items: QueueItem[] }) {
  if (items.length === 0) return <div style={{ color: T.textSoft, fontSize: 13 }}>No active jobs yet. Launch a mission or create media to populate the queue.</div>;
  return (
    <div className="studio-list">
      {items.map(item => (
        <div key={item.jobId ?? item.actionId} style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
            <div>
              <strong style={{ display: 'block', color: T.text, fontSize: 14 }}>{item.name}</strong>
              <div style={{ color: T.textSoft, fontSize: 12, marginTop: 4 }}>{item.workerId} · {item.stage}{item.score != null ? ` · score ${item.score.toFixed(2)}` : ''}</div>
            </div>
            <span style={badgeStyle(T, item.status)}>{item.status}</span>
          </div>
          {item.targetFiles.length > 0 && <div style={{ color: T.textMuted, fontSize: 12, marginTop: 10 }}>{item.targetFiles.slice(0, 3).join(' · ')}</div>}
          {item.error && <div style={{ color: T.danger, fontSize: 12, marginTop: 10 }}>{item.error}</div>}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? dark : light;

  const [tab, setTab] = useState<Tab>('video');
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [musicSubTab, setMusicSubTab] = useState<MusicSubTab>('musicvideo');

  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaDevelopmentStatus | null>(null);
  const [metaBuilderStatus, setMetaBuilderStatus] = useState<MetaBuilderStatus | null>(null);
  const [controlPlane, setControlPlane] = useState<ControlPlaneStatus | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);

  const [missionPrompt, setMissionPrompt] = useState('Build a Roblox game called TrezzWorld Adventures, create original 3D assets, music, voice acting, a cinematic trailer, website, documentation, and launch campaign.');
  const [missionBoot, setMissionBoot] = useState<MissionBootResult | null>(null);
  const [loadingMission, setLoadingMission] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toolMenuRef = useRef<HTMLDivElement>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [useOllama, setUseOllama] = useState(false);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('gemma3:27b');
  const [chatDomain, setChatDomain] = useState('default');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [videoConcept, setVideoConcept] = useState('');
  const [videoDuration, setVideoDuration] = useState(30);
  const [videoStyle, setVideoStyle] = useState('cinematic');
  const [videoResolution, setVideoResolution] = useState('1080p');
  const [videoFps, setVideoFps] = useState(24);
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [videoQuickPrompt, setVideoQuickPrompt] = useState('');
  const videoPolls = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const [musicConcept, setMusicConcept] = useState('');
  const [musicGenre, setMusicGenre] = useState('cinematic');
  const [musicBpm, setMusicBpm] = useState(120);
  const [musicMood, setMusicMood] = useState('epic');
  const [musicDuration, setMusicDuration] = useState(30);
  const [musicResult, setMusicResult] = useState('');
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [musicJobs, setMusicJobs] = useState<MusicJob[]>([]);
  const [creatingMusicJob, setCreatingMusicJob] = useState(false);
  const musicPolls = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const [imageConcept, setImageConcept] = useState('');
  const [imageStyle, setImageStyle] = useState('photorealistic');
  const [imageAspect, setImageAspect] = useState('16:9');
  const [imageCount, setImageCount] = useState(4);
  const [imageResult, setImageResult] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageRenderPrompt, setImageRenderPrompt] = useState('');
  const [imageRenderResult, setImageRenderResult] = useState<ImageRenderResult | null>(null);
  const [renderingImage, setRenderingImage] = useState(false);

  const [codePrompt, setCodePrompt] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('typescript');
  const [codeResult, setCodeResult] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);

  const [userKeys, setUserKeys] = useState<UserKeysResponse | null>(null);
  const [addKeyProvider, setAddKeyProvider] = useState('openrouter');
  const [addKeyValue, setAddKeyValue] = useState('');
  const [addKeyLabel, setAddKeyLabel] = useState('');
  const [addKeyLoading, setAddKeyLoading] = useState(false);
  const [addKeyMsg, setAddKeyMsg] = useState('');

  const [mvSongName, setMvSongName] = useState('');
  const [mvPhotos, setMvPhotos] = useState<string[]>([]);
  const [mvDescription, setMvDescription] = useState('');
  const [mvTitle, setMvTitle] = useState('');
  const [mvAuthor, setMvAuthor] = useState('');
  const [mvStyle, setMvStyle] = useState('music video');
  const [mvDuration, setMvDuration] = useState(120);
  const [creatingMv, setCreatingMv] = useState(false);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!toolMenuRef.current?.contains(event.target as Node)) {
        setToolMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const startPolling = useCallback((missionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchJson<PipelineStatus>(`${API}/api/pipeline/${encodeURIComponent(missionId)}/status`);
        setPipelineStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch {
        /* ignore */
      }
    }, 2500);
  }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  const pollVideoJob = useCallback((jobId: string) => {
    if (videoPolls.current.has(jobId)) return;
    const timer = setInterval(async () => {
      try {
        const job = await fetchJson<VideoJob>(`${API}/api/video/${jobId}/status`);
        setVideoJobs(prev => {
          const next = [...prev];
          const index = next.findIndex(item => item.jobId === jobId);
          if (index >= 0) next[index] = job; else next.unshift(job);
          return next;
        });
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(timer);
          videoPolls.current.delete(jobId);
        }
      } catch {
        clearInterval(timer);
        videoPolls.current.delete(jobId);
      }
    }, 3000);
    videoPolls.current.set(jobId, timer);
  }, []);
  useEffect(() => () => { videoPolls.current.forEach(timer => clearInterval(timer)); }, []);

  const pollMusicJob = useCallback((jobId: string) => {
    if (musicPolls.current.has(jobId)) return;
    const timer = setInterval(async () => {
      try {
        const job = await fetchJson<MusicJob>(`${API}/api/music/${jobId}/status`);
        setMusicJobs(prev => {
          const next = [...prev];
          const index = next.findIndex(item => item.jobId === jobId);
          if (index >= 0) next[index] = job; else next.unshift(job);
          return next;
        });
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(timer);
          musicPolls.current.delete(jobId);
        }
      } catch {
        clearInterval(timer);
        musicPolls.current.delete(jobId);
      }
    }, 3000);
    musicPolls.current.set(jobId, timer);
  }, []);
  useEffect(() => () => { musicPolls.current.forEach(timer => clearInterval(timer)); }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadInitialState = async () => {
      const [
        bk,
        meta,
        mb,
        cp,
        ol,
        keys,
        missions,
        chats,
        videos,
        music,
      ] = await Promise.allSettled([
        fetchJson<BackendStatus>(`${API}/api/status`, controller.signal),
        fetchJson<MetaDevelopmentStatus>(`${API}/api/meta-development/status`, controller.signal),
        fetchJson<MetaBuilderStatus>(`${API}/api/meta-builder/status`, controller.signal),
        fetchJson<ControlPlaneStatus>(`${API}/api/studio/control-plane`, controller.signal),
        fetchJson<OllamaStatus>(`${API}/api/ollama/status`, controller.signal),
        fetchJson<UserKeysResponse>(`${API}/api/lumi/user-keys`, controller.signal),
        fetchJson<MissionListResponse>(`${API}/api/pipeline/missions`, controller.signal),
        fetchJson<ChatHistoryResponse>(`${API}/api/lumi/chat/history?limit=40`, controller.signal),
        fetchJson<VideoJobsResponse>(`${API}/api/video/jobs`, controller.signal),
        fetchJson<MusicJobsResponse>(`${API}/api/music/jobs`, controller.signal),
      ]);

      if (bk.status === 'fulfilled') setBackendStatus(bk.value);
      if (meta.status === 'fulfilled') setMetaStatus(meta.value);
      if (mb.status === 'fulfilled') setMetaBuilderStatus(mb.value);
      if (cp.status === 'fulfilled') setControlPlane(cp.value);
      if (ol.status === 'fulfilled') setOllamaStatus(ol.value);
      if (keys.status === 'fulfilled') setUserKeys(keys.value);
      if (chats.status === 'fulfilled') {
        setChatHistory(
          (chats.value.history ?? [])
            .filter(message => message.role === 'user' || message.role === 'assistant')
            .map(message => ({
              role: message.role as ChatMessage['role'],
              content: message.content,
              model: message.model_used || undefined,
            })),
        );
      }
      if (videos.status === 'fulfilled') {
        setVideoJobs(videos.value.jobs ?? []);
        (videos.value.jobs ?? [])
          .filter(job => job.status !== 'done' && job.status !== 'error')
          .forEach(job => pollVideoJob(job.jobId));
      }
      if (music.status === 'fulfilled') {
        setMusicJobs(music.value.jobs ?? []);
        (music.value.jobs ?? [])
          .filter(job => job.status !== 'done' && job.status !== 'error')
          .forEach(job => pollMusicJob(job.jobId));
      }
      if (missions.status === 'fulfilled') {
        const latestMission = (missions.value.missions ?? []).find(mission => mission.status === 'running' || mission.status === 'pending')
          ?? missions.value.missions?.[0];
        if (latestMission) {
          setActiveMissionId(latestMission.id);
          try {
            const status = await fetchJson<PipelineStatus>(`${API}/api/pipeline/${encodeURIComponent(latestMission.id)}/status`, controller.signal);
            setPipelineStatus(status);
            if (status.status !== 'completed' && status.status !== 'failed') startPolling(latestMission.id);
          } catch {
            /* ignore */
          }
        }
      }
    };
    loadInitialState().catch(() => { /* ignore */ });
    return () => controller.abort();
  }, [pollMusicJob, pollVideoJob, startPolling]);

  const bootMission = async (event: FormEvent) => {
    event.preventDefault();
    setLoadingMission(true);
    try {
      const payload = await postJson<MissionBootResult>(`${API}/api/studio/control-plane/boot`, { prompt: missionPrompt });
      setMissionBoot(payload);
      if (payload.missionId) {
        setActiveMissionId(payload.missionId);
        startPolling(payload.missionId);
      }
    } catch {
      setMissionBoot(null);
    } finally {
      setLoadingMission(false);
    }
  };

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    const requestHistory = [...chatHistory.slice(-20), userMessage].map(message => ({ role: message.role, content: message.content }));
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setLoadingChat(true);
    try {
      const data = await postJson<{ content: string; model: string }>(`${API}/api/lumi/chat`, {
        message: userMessage.content,
        missionId: activeMissionId,
        history: requestHistory,
        useOllama,
        ollamaModel: useOllama ? selectedOllamaModel : null,
        domain: chatDomain === 'default' ? null : chatDomain,
      });
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.content, model: data.model }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: '⚠️ LUMI unavailable. Start the backend and configure OPENROUTER_API_KEY or Ollama.' }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const startVideoCreation = async (event: FormEvent) => {
    event.preventDefault();
    if (!videoConcept.trim()) return;
    setCreatingVideo(true);
    try {
      const job = await postJson<VideoJob>(`${API}/api/video/create`, {
        concept: videoConcept,
        durationSeconds: videoDuration,
        style: videoStyle,
        resolution: videoResolution,
        fps: videoFps,
      });
      setVideoJobs(prev => [job, ...prev]);
      pollVideoJob(job.jobId);
    } catch {
      alert('Failed to start video creation. Is the backend running?');
    } finally {
      setCreatingVideo(false);
    }
  };

  const startQuickVideo = async (event: FormEvent) => {
    event.preventDefault();
    if (!videoQuickPrompt.trim() && !videoConcept.trim()) return;
    const concept = videoQuickPrompt.trim() || videoConcept.trim();
    setCreatingVideo(true);
    try {
      const job = await postJson<VideoJob>(`${API}/api/video/create`, {
        concept,
        durationSeconds: videoDuration,
        style: videoStyle,
        resolution: videoResolution,
        fps: videoFps,
      });
      setVideoJobs(prev => [job, ...prev]);
      pollVideoJob(job.jobId);
      setVideoQuickPrompt('');
      setVideoConcept(concept);
    } catch {
      alert('Failed to start video creation. Is the backend running?');
    } finally {
      setCreatingVideo(false);
    }
  };

  const startMusicCreation = async (event: FormEvent) => {
    event.preventDefault();
    if (!musicConcept.trim()) return;
    setCreatingMusicJob(true);
    try {
      const job = await postJson<MusicJob>(`${API}/api/music/create`, {
        concept: musicConcept,
        genre: musicGenre,
        bpm: musicBpm,
        mood: musicMood,
        durationSeconds: musicDuration,
      });
      setMusicJobs(prev => [job, ...prev]);
      pollMusicJob(job.jobId);
    } catch {
      alert('Failed to start music creation. Is the backend running?');
    } finally {
      setCreatingMusicJob(false);
    }
  };

  const createMusicVideo = async (event: FormEvent) => {
    event.preventDefault();
    const concept = [
      mvSongName ? `Music video for "${mvSongName}".` : 'Untitled music video.',
      mvDescription.trim(),
      mvTitle ? `Title: ${mvTitle}.` : '',
      mvAuthor ? `By: ${mvAuthor}.` : '',
      `Style: ${mvStyle}.`,
      'Create cinematic visuals synchronized to the music with emotional scenes and premium transitions.',
    ].filter(Boolean).join(' ');
    setCreatingMv(true);
    try {
      const job = await postJson<VideoJob>(`${API}/api/video/create`, {
        concept,
        durationSeconds: mvDuration,
        style: 'music video',
        resolution: '1080p',
        fps: 24,
      });
      setVideoJobs(prev => [job, ...prev]);
      pollVideoJob(job.jobId);
      setTab('video');
    } catch {
      alert('Failed to start music video creation. Is the backend running?');
    } finally {
      setCreatingMv(false);
    }
  };

  const generateMusic = async (event: FormEvent) => {
    event.preventDefault();
    if (!musicConcept.trim()) return;
    setGeneratingMusic(true);
    setMusicResult('');
    try {
      const data = await postJson<{ composition: string }>(`${API}/api/music/generate`, {
        concept: musicConcept,
        genre: musicGenre,
        bpm: musicBpm,
        mood: musicMood,
        durationSeconds: musicDuration,
      });
      setMusicResult(data.composition);
    } catch {
      setMusicResult('⚠️ Music generation failed. Is the backend running with OPENROUTER_API_KEY set?');
    } finally {
      setGeneratingMusic(false);
    }
  };

  const renderRealImage = async (event: FormEvent) => {
    event.preventDefault();
    if (!imageRenderPrompt.trim()) return;
    setRenderingImage(true);
    setImageRenderResult(null);
    try {
      const data = await postJson<ImageRenderResult>(`${API}/api/image/render`, {
        prompt: imageRenderPrompt,
        style: imageStyle,
        width: imageAspect === '9:16' ? 1024 : 1024,
        height: imageAspect === '9:16' ? 1820 : imageAspect === '1:1' ? 1024 : 576,
      });
      setImageRenderResult(data);
    } catch {
      setImageRenderResult({ ok: false, provider: 'none', model: 'none', imageBase64: null, format: null, message: '⚠️ Image render failed. Is the backend running?' });
    } finally {
      setRenderingImage(false);
    }
  };

  const generateImage = async (event: FormEvent) => {
    event.preventDefault();
    if (!imageConcept.trim()) return;
    setGeneratingImage(true);
    setImageResult('');
    try {
      const data = await postJson<{ output: string }>(`${API}/api/image/generate`, {
        concept: imageConcept,
        style: imageStyle,
        aspectRatio: imageAspect,
        count: imageCount,
      });
      setImageResult(data.output);
    } catch {
      setImageResult('⚠️ Image prompt generation failed. Is the backend running?');
    } finally {
      setGeneratingImage(false);
    }
  };

  const generateCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!codePrompt.trim()) return;
    setGeneratingCode(true);
    setCodeResult('');
    try {
      const data = await postJson<{ content: string }>(`${API}/api/lumi/chat`, {
        message: `Generate complete, production-ready ${codeLanguage} code for:\n${codePrompt}\n\nProvide clean, runnable output with no placeholders.`,
        domain: 'code',
      });
      setCodeResult(data.content);
    } catch {
      setCodeResult('⚠️ Code generation failed. Is the backend running with OPENROUTER_API_KEY set?');
    } finally {
      setGeneratingCode(false);
    }
  };

  const saveUserKey = async (event: FormEvent) => {
    event.preventDefault();
    if (!addKeyValue.trim()) return;
    setAddKeyLoading(true);
    setAddKeyMsg('');
    try {
      const data = await postJson<{ message: string }>(`${API}/api/lumi/user-key`, {
        provider: addKeyProvider,
        api_key: addKeyValue.trim(),
        label: addKeyLabel.trim(),
      });
      setAddKeyMsg(data.message);
      setAddKeyValue('');
      const fresh = await fetchJson<UserKeysResponse>(`${API}/api/lumi/user-keys`);
      setUserKeys(fresh);
    } catch {
      setAddKeyMsg('⚠️ Failed to save key. Is the backend running?');
    } finally {
      setAddKeyLoading(false);
    }
  };

  const removeUserKey = async (provider: string) => {
    try {
      await fetch(`${API}/api/lumi/user-key/${provider}`, { method: 'DELETE' });
      const fresh = await fetchJson<UserKeysResponse>(`${API}/api/lumi/user-keys`);
      setUserKeys(fresh);
    } catch {
      /* ignore */
    }
  };

  const isBackendUp = Boolean(backendStatus);
  const isOllamaUp = ollamaStatus?.available ?? false;
  const readiness = controlPlane?.productionReadiness.score ?? metaStatus?.productionReadiness.score ?? 0;
  const pipelinePct = pipelineStatus?.progress.percent ?? 0;
  const availableOllamaModels = ollamaStatus?.catalogue.filter(model => model.available) ?? [];
  const activeQueue = pipelineStatus?.jobs ?? missionBoot?.executionQueue ?? controlPlane?.executionQueue ?? [];
  const mvJobs = videoJobs.filter(job => job.style === 'music video');

  const videoTemplates = useMemo<CreativeTemplate[]>(() => [
    {
      id: 'launch-film',
      title: 'Launch Film',
      description: 'A high-end runway-style product reveal with bold supers, clean pacing, and a crisp closing CTA.',
      badge: 'Featured template',
      duration: 30,
      style: 'cinematic',
      tags: ['Hero', 'Brand', 'Launch'],
      artwork: makeArtwork('Launch Film', 'Studio reveal template', '#5b5bd6', '#0ea5e9'),
      actionLabel: 'Use launch template',
      apply: () => { setTab('video'); setVideoStyle('cinematic'); setVideoDuration(30); setVideoConcept('Create a premium launch film for TrezzWorld Production Studio with futuristic UI overlays, sleek camera moves, product feature callouts, and a cinematic final logo reveal.'); setVideoQuickPrompt('Create a premium launch film for TrezzWorld Production Studio.'); },
    },
    {
      id: 'music-drop',
      title: 'Music Drop Visualizer',
      description: 'Album art, beat-synced lighting, artist supers, and motion blur transitions for singles or EP rollouts.',
      badge: 'Music video',
      duration: 45,
      style: 'music video',
      tags: ['Audio', 'Artist', 'Promo'],
      artwork: makeArtwork('Music Drop', 'Beat-led promo video', '#c026d3', '#2563eb'),
      actionLabel: 'Build music rollout',
      apply: () => { setTab('music'); setMusicSubTab('musicvideo'); setMvSongName('TrezzWorld Anthem'); setMvTitle('TrezzWorld Anthem'); setMvDescription('Pulse-reactive neon performance video with intimate portrait shots, crowd energy, and premium motion graphics.'); setMvStyle('music video'); setMvDuration(45); },
    },
    {
      id: 'game-trailer',
      title: 'Game Trailer Cutdown',
      description: 'Open with a world reveal, move into character moments, then finish with platform and launch-date cards.',
      badge: 'Trailer',
      duration: 60,
      style: 'game trailer',
      tags: ['Gameplay', 'Worldbuilding', 'CTA'],
      artwork: makeArtwork('Game Trailer', 'Epic reveal cutdown', '#0f766e', '#7c3aed'),
      actionLabel: 'Cut a trailer',
      apply: () => { setTab('video'); setVideoStyle('game trailer'); setVideoDuration(60); setVideoConcept('Create a game trailer for TrezzWorld Adventures featuring the world map, heroes, battles, traversal, and a cinematic end slate with launch messaging.'); },
    },
    {
      id: 'social-pack',
      title: 'Social Clip Pack',
      description: 'Vertical social-first outputs, punch-in crops, hook cards, and quick export settings for promos.',
      badge: 'Vertical content',
      duration: 20,
      style: 'animated',
      tags: ['9:16', 'Shortform', 'Ads'],
      artwork: makeArtwork('Social Pack', 'Reels + Shorts builder', '#ea580c', '#db2777'),
      actionLabel: 'Create social cuts',
      apply: () => { setTab('video'); setVideoStyle('animated'); setVideoResolution('vertical'); setVideoDuration(20); setVideoConcept('Create three vertical teaser clips for studio.trezzhaus.com that show templates, AI generation, and creator workflows with strong hooks.'); },
    },
  ], []);

  const stockAssets = useMemo<StockAsset[]>(() => [
    {
      id: 'city-night',
      kind: 'video',
      title: 'Neon City Atmosphere',
      description: 'A ready-made scene concept for night driving shots, skyline reveals, and moody inserts.',
      tags: ['Urban', 'Night', 'B-roll'],
      artwork: makeArtwork('Neon City', 'Stock scene concept', '#1d4ed8', '#9333ea'),
      actionLabel: 'Use in video prompt',
      apply: () => { setTab('video'); setVideoQuickPrompt('Use neon city night driving visuals, glowing signage, reflections on wet pavement, and moody skyline reveals.'); },
    },
    {
      id: 'portrait-film',
      kind: 'image',
      title: 'Film Portrait Starter',
      description: 'A stock still direction for shallow depth-of-field portraits, fashion campaigns, and editorial covers.',
      tags: ['Portrait', 'Film', 'Fashion'],
      artwork: makeArtwork('Film Portrait', 'Image starter scene', '#c026d3', '#0f172a'),
      actionLabel: 'Use in image prompt',
      apply: () => { setTab('image'); setImageStyle('cinematic'); setImageAspect('3:2'); setImageRenderPrompt('A color film-inspired portrait of a stylish young creator looking to the side, shallow depth of field, fine grain, wide aperture, candid documentary mood.'); },
    },
    {
      id: 'orchestral-rise',
      kind: 'music',
      title: 'Orchestral Rise Bed',
      description: 'A music brief starter for emotional strings, hybrid percussion, and launch-ready crescendos.',
      tags: ['Score', 'Epic', 'Trailer'],
      artwork: makeArtwork('Orchestral Rise', 'Music brief starter', '#0f766e', '#14b8a6'),
      actionLabel: 'Use in music prompt',
      apply: () => { setTab('music'); setMusicSubTab('audio'); setMusicGenre('cinematic'); setMusicMood('uplifting'); setMusicDuration(45); setMusicConcept('Compose a premium orchestral rise with hybrid drums, emotional strings, and a confident studio launch energy.'); },
    },
    {
      id: 'product-stage',
      kind: 'video',
      title: 'Stage Spotlight Intro',
      description: 'Use for logo reveals, presenter openers, or premium hero moments with volumetric light.',
      tags: ['Stage', 'Reveal', 'Spotlight'],
      artwork: makeArtwork('Stage Intro', 'Presentation opener', '#f59e0b', '#ec4899'),
      actionLabel: 'Apply spotlight opener',
      apply: () => { setTab('video'); setVideoQuickPrompt('Open on a dark stage with a moving spotlight, floating dust particles, dramatic atmosphere, and a premium logo reveal.'); },
    },
  ], []);

  const imagePresets = useMemo<CreativeTemplate[]>(() => [
    {
      id: 'editorial-cover',
      title: 'Editorial Cover',
      description: 'High-contrast portrait direction with dramatic lighting and premium magazine composition.',
      badge: 'Image preset',
      tags: ['Portrait', 'Cover', '3:2'],
      artwork: makeArtwork('Editorial Cover', 'Premium portrait treatment', '#7c3aed', '#0891b2'),
      actionLabel: 'Use cover preset',
      apply: () => { setTab('image'); setImageStyle('cinematic'); setImageAspect('3:2'); setImageRenderPrompt('A premium editorial portrait cover, dramatic side lighting, shallow depth of field, tactile film grain, refined wardrobe, luxury magazine aesthetic.'); },
    },
    {
      id: 'product-keyart',
      title: 'Product Key Art',
      description: 'Stylized product hero imagery with gradient reflections, crisp focus, and launch-campaign polish.',
      badge: 'Campaign art',
      tags: ['Key Art', 'Product', '16:9'],
      artwork: makeArtwork('Product Key Art', 'Launch campaign still', '#1d4ed8', '#06b6d4'),
      actionLabel: 'Use product preset',
      apply: () => { setTab('image'); setImageStyle('photorealistic'); setImageAspect('16:9'); setImageRenderPrompt('Create premium product key art for TrezzWorld Production Studio UI floating in a glossy dark environment with dramatic reflections and cinematic studio lighting.'); },
    },
    {
      id: 'world-poster',
      title: 'World Poster',
      description: 'Epic fantasy poster composition for game worlds, film universes, and launch keyframes.',
      badge: 'Poster art',
      tags: ['Fantasy', 'Poster', 'Wide'],
      artwork: makeArtwork('World Poster', 'Franchise keyframe', '#f97316', '#7c3aed'),
      actionLabel: 'Use poster preset',
      apply: () => { setTab('image'); setImageStyle('digital art'); setImageAspect('16:9'); setImageConcept('TrezzWorld Adventures universe poster with heroic cast, towering landscape, dramatic sky, glowing artifacts, and cinematic scale.'); },
    },
  ], []);

  const codePresets = useMemo<CreativeTemplate[]>(() => [
    {
      id: 'react-uploader',
      title: 'Media Upload Panel',
      description: 'Generate a polished uploader with drag-and-drop, validation, progress, and status chips.',
      badge: 'UI starter',
      tags: ['React', 'Uploader', 'Dashboard'],
      artwork: makeArtwork('Media Upload', 'Frontend scaffold', '#0f766e', '#2563eb'),
      actionLabel: 'Use code starter',
      apply: () => { setTab('code'); setCodeLanguage('typescript'); setCodePrompt('Build a production-ready React + TypeScript media upload panel with drag-and-drop, file preview cards, progress indicators, error states, and cancel actions.'); },
    },
    {
      id: 'python-pipeline',
      title: 'Pipeline Worker',
      description: 'Generate a Python worker that pulls jobs, updates progress, retries safely, and logs structured output.',
      badge: 'Backend starter',
      tags: ['Python', 'Workers', 'Queue'],
      artwork: makeArtwork('Pipeline Worker', 'Backend service scaffold', '#7c3aed', '#22c55e'),
      actionLabel: 'Use worker starter',
      apply: () => { setTab('code'); setCodeLanguage('python'); setCodePrompt('Generate a Python async pipeline worker with retries, status updates, structured logging, and clean error handling for media generation jobs.'); },
    },
  ], []);

  const pageTitle = NAV_ITEMS.find(item => item.id === tab)?.label ?? 'Studio';
  const openToolTab = (nextTab: Tab) => { setTab(nextTab); setToolMenuOpen(false); };
  const quickToolOptions: Array<{ id: string; label: string; caption: string; tab: Tab }> = [
    { id: 'model', label: 'Model', caption: 'Choose cloud/local model + domain', tab: 'chat' },
    { id: 'design', label: 'Design', caption: 'Image direction + prompt tools', tab: 'image' },
    { id: 'output', label: 'Output', caption: 'Code/docs output panel + export', tab: 'code' },
    { id: 'edit', label: 'Edit', caption: 'Video timeline + controls', tab: 'video' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: T.bgRadial, color: T.text }}>
      <style>{SHELL_CSS}</style>
      <div className="studio-shell">
        <aside className="studio-sidebar studio-scroll" style={{ background: T.panelAlt, borderRight: `1px solid ${T.border}`, padding: 22 }}>
          <div style={{ ...panelStyle(T, { padding: 18, marginBottom: 18, background: 'transparent', boxShadow: 'none' }) }}>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -1, marginBottom: 4 }}>TrezzWorld</div>
            <div style={{ color: T.textMuted, fontSize: 13 }}>Production Studio</div>
            <div style={{ marginTop: 18, padding: 16, borderRadius: 20, background: T.accentGradient, color: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 }}>Runway-style workspace</div>
              <div style={{ fontSize: 20, fontWeight: 900, marginTop: 6 }}>All tabs, one polished shell.</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8, opacity: 0.9 }}>Templates, stock starters, image rendering, music, code, and LUMI mission control together.</div>
            </div>
          </div>

          <div className="studio-list" style={{ marginBottom: 18 }}>
            {NAV_ITEMS.map(item => {
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: 18,
                    border: `1px solid ${active ? T.borderStrong : T.border}`,
                    background: active ? T.panelSoft : 'transparent',
                    color: active ? T.text : T.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: T.textSoft }}>{item.caption}</div>
                      </div>
                    </div>
                    {active ? <span style={{ width: 10, height: 10, borderRadius: 999, background: T.accent2 }} /> : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ ...panelStyle(T, { padding: 16, marginBottom: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ color: T.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Status</span>
              <span style={badgeStyle(T, isBackendUp ? 'online' : 'offline')}>{isBackendUp ? 'Online' : 'Offline'}</span>
            </div>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>Production readiness {readiness}%</div>
            <div style={{ color: T.textSoft, fontSize: 12, marginTop: 6 }}>{metaBuilderStatus?.summary ?? 'Waiting for backend status…'}</div>
          </div>

          <button onClick={() => setIsDark(value => !value)} style={{ ...buttonStyle(T, 'ghost'), width: '100%' }}>
            {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          </button>
        </aside>

        <main className="studio-main" style={{ padding: 24 }}>
          <div style={{ ...panelStyle(T, { padding: 18, marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }) }}>
            <div>
              <div style={{ fontSize: 12, color: T.textSoft, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>studio.trezzhaus.com</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{pageTitle}</div>
              <div style={{ fontSize: 14, color: T.textMuted, marginTop: 4 }}>{controlPlane?.finishLine ?? 'Build cinematic media, images, code, and campaigns from one premium dashboard.'}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div ref={toolMenuRef} style={{ position: 'relative' }}>
                <button onClick={() => setToolMenuOpen(value => !value)} style={buttonStyle(T, 'ghost')}>{toolMenuOpen ? 'Close tools' : 'All tools'}</button>
                {toolMenuOpen && (
                  <div style={{ ...panelStyle(T, { padding: 14, position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 380, zIndex: 20, boxShadow: T.shadow }), background: T.panelAlt }}>
                    <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Quick options</div>
                    <div className="studio-list" style={{ marginBottom: 14 }}>
                      {quickToolOptions.map(option => (
                        <button key={option.id} onClick={() => openToolTab(option.tab)} style={{ ...buttonStyle(T, tab === option.tab ? 'secondary' : 'ghost'), textAlign: 'left', width: '100%' }}>
                          <div style={{ fontWeight: 800, color: tab === option.tab ? T.text : T.textMuted }}>{option.label}</div>
                          <div style={{ fontSize: 12, marginTop: 4, color: T.textSoft }}>{option.caption}</div>
                        </button>
                      ))}
                    </div>
                    <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>All tools</div>
                    <div className="studio-list">
                      {NAV_ITEMS.map(item => (
                        <button key={`tool-${item.id}`} onClick={() => openToolTab(item.id)} style={{ ...buttonStyle(T, tab === item.id ? 'secondary' : 'ghost'), textAlign: 'left', width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 800, color: tab === item.id ? T.text : T.textMuted }}>{item.icon} {item.label}</span>
                            <span style={{ fontSize: 11, color: T.textSoft }}>{item.caption}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => { setTab('video'); setVideoQuickPrompt('Create a cinematic product teaser for TrezzWorld Production Studio.'); }} style={buttonStyle(T, 'secondary')}>Quick teaser</button>
              <button onClick={() => setTab('settings')} style={buttonStyle(T, 'ghost')}>Providers</button>
            </div>
          </div>

          {tab === 'home' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <section className="studio-grid-4">
                <MetricCard T={T} label="Readiness" value={`${readiness}%`} hint={metaStatus?.highestRoiNextMove ?? 'Backend will surface the next highest-ROI move here.'} />
                <MetricCard T={T} label="Source files" value={`${metaStatus?.repositoryIntelligence.sourceFiles ?? '—'}`} hint={`${metaStatus?.repositoryIntelligence.todoMarkers ?? 0} TODO markers detected`} />
                <MetricCard T={T} label="Autonomy" value={`${metaBuilderStatus?.readinessEstimate ?? 0}%`} hint={metaBuilderStatus?.summary ?? 'Awaiting meta-builder summary'} />
                <MetricCard T={T} label="Delivery surfaces" value={`${controlPlane?.deliverySurfaces.length ?? 0}`} hint='Studio, web, campaigns, video, music, and deployment surfaces' />
              </section>

              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 24, background: T.accentGradient, color: '#fff' })}>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', opacity: 0.85 }}>Mission launcher</div>
                  <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: '10px 0 12px' }}>{controlPlane?.workspaceTitle ?? 'TrezzWorld Production Studio'}</h1>
                  <p style={{ margin: '0 0 18px', maxWidth: 740, lineHeight: 1.7, fontSize: 14, opacity: 0.94 }}>Launch a single prompt that coordinates assets, media, code, and campaigns. This shell now surfaces templates and stock starters instead of leaving the workspace empty.</p>
                  <form onSubmit={bootMission} style={{ display: 'grid', gap: 14 }}>
                    <textarea value={missionPrompt} onChange={event => setMissionPrompt(event.target.value)} rows={5} style={{ ...inputStyle(T, { background: 'rgba(0,0,0,0.16)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }) }} placeholder={controlPlane?.missionPromptPlaceholder ?? 'Describe your mission'} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 13, opacity: 0.9 }}>{missionBoot ? `${missionBoot.status} · ${missionBoot.plannerModel ?? 'cascade planner'}${missionBoot.missionId ? ` · ${missionBoot.missionId}` : ''}` : 'Mission planning will populate the execution queue and next actions.'}</div>
                      <button type="submit" disabled={loadingMission} style={buttonStyle(T, 'ghost', loadingMission)}>{loadingMission ? 'Booting…' : 'Boot LUMI mission'}</button>
                    </div>
                  </form>
                  {pipelineStatus && (
                    <div style={{ marginTop: 16 }}>
                      <ProgressBar pct={pipelinePct} status={pipelineStatus.status} T={T} />
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.88 }}>{pipelineStatus.progress.completed} completed · {pipelineStatus.progress.running} running · {pipelineStatus.progress.errored} errors</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={panelStyle(T, { padding: 20 })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <h2 style={sectionTitleStyle(T)}>Delivery surfaces</h2>
                      <span style={badgeStyle(T, `${controlPlane?.deliverySurfaces.length ?? 0}`)}>{controlPlane?.deliverySurfaces.length ?? 0}</span>
                    </div>
                    <div className="studio-list">
                      {(controlPlane?.deliverySurfaces ?? []).map(surface => (
                        <div key={surface.name} style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                            <strong style={{ color: T.text }}>{surface.name}</strong>
                            <span style={badgeStyle(T, surface.status)}>{surface.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={panelStyle(T, { padding: 20 })}>
                    <h2 style={sectionTitleStyle(T)}>Execution queue</h2>
                    <div style={{ marginTop: 14 }}><QueueList T={T} items={activeQueue} /></div>
                  </div>
                </div>
              </section>

              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={sectionTitleStyle(T)}>Creative starter packs</h2>
                    <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>Curated templates and stock starter directions wired into the tabs you already have.</div>
                  </div>
                </div>
                <div className="studio-grid-4">
                  {videoTemplates.map(template => <TemplateCard key={template.id} T={T} template={template} />)}
                </div>
              </section>

              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Workspace modules</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {(controlPlane?.workspaceModules ?? []).map(module => (
                      <div key={module.id} style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <strong style={{ color: T.text }}>{module.name}</strong>
                          <span style={badgeStyle(T, module.status)}>{module.status}</span>
                        </div>
                        <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>{module.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Capability providers</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {(controlPlane?.capabilityProviders ?? []).map(provider => (
                      <div key={`${provider.capability}-${provider.providerId}`} style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <strong style={{ color: T.text }}>{provider.capability}</strong>
                          <span style={badgeStyle(T, provider.status)}>{provider.status}</span>
                        </div>
                        <div style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>{provider.providerId} · {provider.providerKind} · {provider.route}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'video' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 24, background: T.panelAlt })}>
                  <div style={{ color: T.accent2, fontWeight: 800, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>Runway-inspired video composer</div>
                  <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05 }}>Beautiful AI video workflows without the empty screen.</h1>
                  <p style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.7, margin: '12px 0 18px' }}>This tab now leads with templates, a stock starter library, quick prompts, and the full advanced controls already wired to your backend video API.</p>
                  <form onSubmit={startQuickVideo} style={{ display: 'grid', gap: 14 }}>
                    <textarea value={videoQuickPrompt} onChange={event => setVideoQuickPrompt(event.target.value)} rows={4} style={inputStyle(T)} placeholder='Describe the video you want, paste a script, or start from one of the templates below…' />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {['Create a luxury fashion trailer.', 'Turn product screenshots into a feature teaser.', 'Cut a Roblox world trailer with end slate.', 'Build a cinematic social ad in 9:16.'].map(prompt => (
                        <button key={prompt} type="button" onClick={() => { setVideoQuickPrompt(prompt); setVideoConcept(prompt); }} style={buttonStyle(T, 'ghost')}>{prompt}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button type="submit" disabled={creatingVideo || (!videoQuickPrompt.trim() && !videoConcept.trim())} style={buttonStyle(T, 'primary', creatingVideo || (!videoQuickPrompt.trim() && !videoConcept.trim()))}>{creatingVideo ? 'Starting…' : 'Generate video'}</button>
                      <span style={{ color: T.textSoft, fontSize: 13 }}>Uses <strong style={{ color: T.text }}>{videoStyle}</strong> · {videoResolution} · {videoFps}fps</span>
                    </div>
                  </form>
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={panelStyle(T, { padding: 16 })}>
                    <img src={makeArtwork('Video Workspace', 'Templates + stock starters', '#4f46e5', '#06b6d4')} alt="Video workspace preview" style={{ width: '100%', borderRadius: 20, border: `1px solid ${T.border}` }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
                      <div style={{ ...panelStyle(T, { padding: 12, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Templates</div>
                        <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>{videoTemplates.length}</div>
                      </div>
                      <div style={{ ...panelStyle(T, { padding: 12, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Stock starters</div>
                        <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>{stockAssets.filter(item => item.kind === 'video').length}</div>
                      </div>
                      <div style={{ ...panelStyle(T, { padding: 12, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Recent jobs</div>
                        <div style={{ color: T.text, fontSize: 20, fontWeight: 900 }}>{videoJobs.length}</div>
                      </div>
                    </div>
                  </div>
                  <div style={panelStyle(T, { padding: 18 })}>
                    <h2 style={sectionTitleStyle(T)}>Provider-backed presets</h2>
                    <div style={{ color: T.textMuted, fontSize: 13, marginTop: 6 }}>Quickly fill the form and start the existing backend pipeline.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                      <button onClick={() => { setVideoStyle('cinematic'); setVideoDuration(30); setVideoResolution('1080p'); }} style={buttonStyle(T, 'secondary')}>Cinematic</button>
                      <button onClick={() => { setVideoStyle('documentary'); setVideoDuration(45); }} style={buttonStyle(T, 'secondary')}>Documentary</button>
                      <button onClick={() => { setVideoStyle('animated'); setVideoResolution('vertical'); }} style={buttonStyle(T, 'secondary')}>Vertical social</button>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={sectionTitleStyle(T)}>Templates</h2>
                    <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>Closer to the reference layout: visual cards first, controls second.</div>
                  </div>
                </div>
                <div className="studio-grid-4">
                  {videoTemplates.map(template => <TemplateCard key={template.id} T={T} template={template} />)}
                </div>
              </section>

              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={sectionTitleStyle(T)}>Stock starters</h2>
                    <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>Open-source style starter directions for clips, keyframes, and atmosphere references.</div>
                  </div>
                </div>
                <div className="studio-grid-4">
                  {stockAssets.map(asset => <AssetCard key={asset.id} T={T} asset={asset} />)}
                </div>
              </section>

              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 22 })}>
                  <h2 style={sectionTitleStyle(T)}>Advanced video controls</h2>
                  <form onSubmit={startVideoCreation} style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                    <textarea value={videoConcept} onChange={event => setVideoConcept(event.target.value)} rows={5} style={inputStyle(T)} placeholder='Describe your cinematic sequence, product teaser, trailer, or feature tour…' />
                    <div className="studio-grid-3">
                      <div>
                        <label style={{ display: 'block', color: T.textMuted, fontSize: 12, marginBottom: 8 }}>Style</label>
                        <select value={videoStyle} onChange={event => setVideoStyle(event.target.value)} style={inputStyle(T)}>
                          {VIDEO_STYLE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', color: T.textMuted, fontSize: 12, marginBottom: 8 }}>Resolution</label>
                        <select value={videoResolution} onChange={event => setVideoResolution(event.target.value)} style={inputStyle(T)}>
                          <option value="1080p">1080p</option>
                          <option value="720p">720p</option>
                          <option value="4k">4K</option>
                          <option value="vertical">Vertical</option>
                          <option value="square">Square</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', color: T.textMuted, fontSize: 12, marginBottom: 8 }}>Frame rate</label>
                        <select value={videoFps} onChange={event => setVideoFps(Number(event.target.value))} style={inputStyle(T)}>
                          <option value={24}>24 fps</option>
                          <option value={30}>30 fps</option>
                          <option value={60}>60 fps</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: T.textMuted, fontSize: 12 }}>Duration</span>
                        <span style={{ color: T.text, fontWeight: 700 }}>{fmtDur(videoDuration)}</span>
                      </div>
                      <input type="range" min={5} max={180} step={5} value={videoDuration} onChange={event => setVideoDuration(Number(event.target.value))} style={{ width: '100%', accentColor: T.accent }} />
                    </div>
                    <button type="submit" disabled={creatingVideo || !videoConcept.trim()} style={buttonStyle(T, 'primary', creatingVideo || !videoConcept.trim())}>{creatingVideo ? 'Starting…' : 'Create full project'}</button>
                  </form>
                </div>
                <div style={panelStyle(T, { padding: 22 })}>
                  <h2 style={sectionTitleStyle(T)}>Recent video projects</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {videoJobs.length === 0 && <div style={{ color: T.textSoft, fontSize: 13 }}>No projects yet. Use a template above or enter a concept.</div>}
                    {videoJobs.map(job => (
                      <div key={job.jobId} style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                          <div>
                            <strong style={{ color: T.text, display: 'block' }}>{truncate(job.concept, 90)}</strong>
                            <div style={{ color: T.textSoft, fontSize: 12, marginTop: 4 }}>{fmtDur(job.durationSeconds)} · {job.style} · {job.resolution} · {job.fps}fps</div>
                          </div>
                          <span style={badgeStyle(T, job.status)}>{job.status}</span>
                        </div>
                        <div style={{ marginTop: 12 }}><ProgressBar pct={job.progress} status={job.status} T={T} /></div>
                        <div style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>{job.message || 'Queued in video pipeline'}</div>
                        {job.downloadReady && <button onClick={() => { const anchor = document.createElement('a'); anchor.href = `${API}/api/video/${job.jobId}/download`; anchor.download = `trezzworld-video-${job.jobId.slice(0, 8)}.mp4`; anchor.click(); }} style={{ ...buttonStyle(T, 'secondary'), marginTop: 12 }}>Download MP4</button>}
                        {job.storyboard?.scenes?.length ? <div style={{ color: T.textSoft, fontSize: 12, marginTop: 8 }}>{job.storyboard.scenes.length} storyboard scenes ready</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'music' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 24 })}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                    <button onClick={() => setMusicSubTab('musicvideo')} style={buttonStyle(T, musicSubTab === 'musicvideo' ? 'primary' : 'ghost')}>Music video</button>
                    <button onClick={() => setMusicSubTab('audio')} style={buttonStyle(T, musicSubTab === 'audio' ? 'primary' : 'ghost')}>Audio only</button>
                  </div>

                  {musicSubTab === 'musicvideo' ? (
                    <form onSubmit={createMusicVideo} style={{ display: 'grid', gap: 14 }}>
                      <input value={mvSongName} onChange={event => setMvSongName(event.target.value)} style={inputStyle(T)} placeholder='Song name or uploaded source' />
                      <textarea value={mvDescription} onChange={event => setMvDescription(event.target.value.slice(0, 2000))} rows={5} style={inputStyle(T)} placeholder='Describe the emotion, art direction, performance energy, and visual story for the video…' />
                      <div className="studio-grid-3">
                        <input value={mvTitle} onChange={event => setMvTitle(event.target.value.slice(0, 30))} style={inputStyle(T)} placeholder='Video title' />
                        <input value={mvAuthor} onChange={event => setMvAuthor(event.target.value.slice(0, 30))} style={inputStyle(T)} placeholder='Artist / author' />
                        <select value={mvStyle} onChange={event => setMvStyle(event.target.value)} style={inputStyle(T)}>
                          <option value="music video">Music video</option>
                          <option value="cinematic">Cinematic</option>
                          <option value="animated">Animated</option>
                          <option value="lo-fi aesthetic">Lo-fi aesthetic</option>
                          <option value="epic fantasy">Epic fantasy</option>
                          <option value="documentary">Documentary</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted, fontSize: 12, marginBottom: 8 }}>
                          <span>Music video duration</span>
                          <span style={{ color: T.text, fontWeight: 700 }}>{fmtDur(mvDuration)}</span>
                        </div>
                        <input type="range" min={15} max={240} step={5} value={mvDuration} onChange={event => setMvDuration(Number(event.target.value))} style={{ width: '100%', accentColor: T.accent }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: T.textMuted, fontSize: 12, marginBottom: 10 }}>Reference stills</label>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {mvPhotos.map((photo, index) => (
                            <div key={`${photo}-${index}`} style={{ position: 'relative' }}>
                              <img src={photo} alt={`Reference ${index + 1}`} style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', border: `1px solid ${T.border}` }} />
                              <button type="button" onClick={() => setMvPhotos(prev => prev.filter((_, current) => current !== index))} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999, border: 'none', background: T.danger, color: '#fff', cursor: 'pointer' }}>×</button>
                            </div>
                          ))}
                          <label style={{ ...panelStyle(T, { width: 72, height: 72, display: 'grid', placeItems: 'center', cursor: 'pointer', background: T.panelSoft, boxShadow: 'none' }) }}>
                            <span style={{ color: T.textMuted, fontSize: 12, textAlign: 'center' }}>Add
photos</span>
                            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={event => {
                              if (!event.target.files) return;
                              Array.from(event.target.files).forEach(file => {
                                const reader = new FileReader();
                                reader.onload = loadEvent => setMvPhotos(prev => [...prev, loadEvent.target?.result as string]);
                                reader.readAsDataURL(file);
                              });
                            }} />
                          </label>
                        </div>
                      </div>
                      <button type="submit" disabled={creatingMv} style={buttonStyle(T, 'primary', creatingMv)}>{creatingMv ? 'Starting…' : 'Create music video'}</button>
                    </form>
                  ) : (
                    <form onSubmit={startMusicCreation} style={{ display: 'grid', gap: 14 }}>
                      <textarea value={musicConcept} onChange={event => setMusicConcept(event.target.value)} rows={5} style={inputStyle(T)} placeholder='Describe the track: vibe, instrumentation, tempo, mix references, and where it will be used…' />
                      <div className="studio-grid-3">
                        <select value={musicGenre} onChange={event => setMusicGenre(event.target.value)} style={inputStyle(T)}>
                          <option value="cinematic">Cinematic</option>
                          <option value="hip hop">Hip hop</option>
                          <option value="electronic">Electronic</option>
                          <option value="ambient">Ambient</option>
                          <option value="orchestral">Orchestral</option>
                          <option value="pop">Pop</option>
                        </select>
                        <input value={musicMood} onChange={event => setMusicMood(event.target.value)} style={inputStyle(T)} placeholder='Mood (epic, moody, uplifting…)'/>
                        <input type="number" value={musicBpm} onChange={event => setMusicBpm(Number(event.target.value))} style={inputStyle(T)} min={60} max={200} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: T.textMuted, fontSize: 12, marginBottom: 8 }}>
                          <span>Track length</span>
                          <span style={{ color: T.text, fontWeight: 700 }}>{fmtDur(musicDuration)}</span>
                        </div>
                        <input type="range" min={10} max={180} step={5} value={musicDuration} onChange={event => setMusicDuration(Number(event.target.value))} style={{ width: '100%', accentColor: T.accent }} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button type="submit" disabled={creatingMusicJob || !musicConcept.trim()} style={buttonStyle(T, 'primary', creatingMusicJob || !musicConcept.trim())}>{creatingMusicJob ? 'Starting…' : 'Generate real audio'}</button>
                        <button type="button" onClick={(event) => { void generateMusic(event as unknown as FormEvent); }} disabled={generatingMusic || !musicConcept.trim()} style={buttonStyle(T, 'secondary', generatingMusic || !musicConcept.trim())}>{generatingMusic ? 'Writing brief…' : 'Write composition brief'}</button>
                      </div>
                    </form>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 18 }}>
                  <div style={panelStyle(T, { padding: 18 })}>
                    <img src={makeArtwork('Music Studio', 'Album visuals + audio generation', '#db2777', '#2563eb')} alt="Music workspace preview" style={{ width: '100%', borderRadius: 18, border: `1px solid ${T.border}` }} />
                    <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginTop: 12 }}>Use this tab for audio-only generation or full music-video concepts with uploaded stills and styling.</div>
                  </div>
                  <div style={panelStyle(T, { padding: 18 })}>
                    <h2 style={sectionTitleStyle(T)}>Starter packs</h2>
                    <div className="studio-list" style={{ marginTop: 14 }}>
                      {videoTemplates.filter(template => template.badge !== 'Featured template').slice(0, 3).map(template => <TemplateCard key={template.id} T={T} template={template} />)}
                    </div>
                  </div>
                </div>
              </section>

              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Recent music jobs</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {musicJobs.length === 0 && <div style={{ color: T.textSoft, fontSize: 13 }}>No music jobs yet. Start from the audio form or use a stock starter.</div>}
                    {musicJobs.map(job => (
                      <div key={job.jobId} style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                          <div>
                            <strong style={{ color: T.text }}>{truncate(job.concept, 88)}</strong>
                            <div style={{ color: T.textSoft, fontSize: 12, marginTop: 4 }}>{job.genre} · {fmtDur(job.durationSeconds)} · {job.provider}</div>
                          </div>
                          <span style={badgeStyle(T, job.status)}>{job.status}</span>
                        </div>
                        <div style={{ marginTop: 12 }}><ProgressBar pct={job.progress} status={job.status} T={T} /></div>
                        <div style={{ color: T.textMuted, fontSize: 12, marginTop: 8 }}>{job.message || job.compositionBrief}</div>
                        {job.downloadReady && <button onClick={() => { const anchor = document.createElement('a'); anchor.href = `${API}/api/music/${job.jobId}/download`; anchor.download = `trezzworld-audio-${job.jobId.slice(0, 8)}.${job.outputFormat ?? 'wav'}`; anchor.click(); }} style={{ ...buttonStyle(T, 'secondary'), marginTop: 12 }}>Download audio</button>}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Composition brief output</h2>
                  <div style={{ ...panelStyle(T, { padding: 16, background: T.panelSoft, boxShadow: 'none', marginTop: 14, minHeight: 240 }) }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: musicResult ? T.text : T.textSoft, lineHeight: 1.7 }}>{musicResult || 'Generate a brief from the audio form to see lyrics, arrangement, and production direction here.'}</pre>
                  </div>
                  {mvJobs.length > 0 && <div style={{ color: T.textMuted, fontSize: 12, marginTop: 12 }}>{mvJobs.length} music-video styled jobs also appear in the Video tab.</div>}
                </div>
              </section>
            </div>
          )}

          {tab === 'image' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 22 })}>
                  <div style={{ color: T.accent2, fontWeight: 800, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>Render real images</div>
                  <h1 style={{ margin: 0, fontSize: 32 }}>Premium visuals with presets, prompt engineering, and direct provider rendering.</h1>
                  <p style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.7, margin: '12px 0 18px' }}>Image rendering now lives in a richer workspace with poster presets, stock starters, and better art direction surfaces.</p>
                  <form onSubmit={renderRealImage} style={{ display: 'grid', gap: 14 }}>
                    <textarea value={imageRenderPrompt} onChange={event => setImageRenderPrompt(event.target.value)} rows={5} style={inputStyle(T)} placeholder='Describe the exact still you want to generate…' />
                    <div className="studio-grid-3">
                      <select value={imageStyle} onChange={event => setImageStyle(event.target.value)} style={inputStyle(T)}>
                        {IMAGE_STYLE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <select value={imageAspect} onChange={event => setImageAspect(event.target.value)} style={inputStyle(T)}>
                        <option value="16:9">16:9</option>
                        <option value="3:2">3:2</option>
                        <option value="1:1">1:1</option>
                        <option value="9:16">9:16</option>
                        <option value="4:3">4:3</option>
                      </select>
                      <button type="submit" disabled={renderingImage || !imageRenderPrompt.trim()} style={buttonStyle(T, 'primary', renderingImage || !imageRenderPrompt.trim())}>{renderingImage ? 'Rendering…' : 'Render image'}</button>
                    </div>
                  </form>
                </div>
                <div style={panelStyle(T, { padding: 18, display: 'grid', alignContent: 'start', gap: 14 })}>
                  {imageRenderResult?.ok && imageRenderResult.imageBase64 ? (
                    <>
                      <img src={`data:image/${imageRenderResult.format ?? 'png'};base64,${imageRenderResult.imageBase64}`} alt="Generated output" style={{ width: '100%', borderRadius: 18, border: `1px solid ${T.border}` }} />
                      <div style={{ color: T.textMuted, fontSize: 13 }}>{imageRenderResult.message}</div>
                      <button onClick={() => { const anchor = document.createElement('a'); anchor.href = `data:image/${imageRenderResult.format};base64,${imageRenderResult.imageBase64}`; anchor.download = `trezzworld-render.${imageRenderResult.format}`; anchor.click(); }} style={buttonStyle(T, 'secondary')}>Download image</button>
                    </>
                  ) : (
                    <>
                      <img src={makeArtwork('Image Render', 'Preview canvas', '#4f46e5', '#ec4899')} alt="Image preview placeholder" style={{ width: '100%', borderRadius: 18, border: `1px solid ${T.border}` }} />
                      <div style={{ color: imageRenderResult ? T.danger : T.textMuted, fontSize: 13 }}>{imageRenderResult?.message ?? 'Rendered output will appear here with download controls and provider details.'}</div>
                    </>
                  )}
                </div>
              </section>

              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={sectionTitleStyle(T)}>Poster and keyframe presets</h2>
                    <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>Starter looks for studio campaigns, characters, products, and world-building.</div>
                  </div>
                </div>
                <div className="studio-grid-3">
                  {imagePresets.map(template => <TemplateCard key={template.id} T={T} template={template} />)}
                </div>
              </section>

              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Prompt engineer</h2>
                  <form onSubmit={generateImage} style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                    <textarea value={imageConcept} onChange={event => setImageConcept(event.target.value)} rows={4} style={inputStyle(T)} placeholder='Need prompt packs for Midjourney, Firefly, DALL-E, or Stable Diffusion? Describe the asset here…' />
                    <div className="studio-grid-3">
                      <select value={imageAspect} onChange={event => setImageAspect(event.target.value)} style={inputStyle(T)}>
                        <option value="16:9">16:9</option>
                        <option value="1:1">1:1</option>
                        <option value="9:16">9:16</option>
                        <option value="4:3">4:3</option>
                        <option value="3:2">3:2</option>
                        <option value="21:9">21:9</option>
                      </select>
                      <select value={imageCount} onChange={event => setImageCount(Number(event.target.value))} style={inputStyle(T)}>
                        <option value={1}>1 variation</option>
                        <option value={2}>2 variations</option>
                        <option value={4}>4 variations</option>
                        <option value={6}>6 variations</option>
                        <option value={8}>8 variations</option>
                      </select>
                      <button type="submit" disabled={generatingImage || !imageConcept.trim()} style={buttonStyle(T, 'secondary', generatingImage || !imageConcept.trim())}>{generatingImage ? 'Writing prompts…' : 'Generate prompts'}</button>
                    </div>
                  </form>
                  {imageResult && (
                    <div style={{ ...panelStyle(T, { padding: 16, background: T.panelSoft, boxShadow: 'none', marginTop: 14 }) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                        <strong style={{ color: T.text }}>Generated prompt pack</strong>
                        <button onClick={() => downloadTextFile(imageResult, 'image-prompts.txt')} style={buttonStyle(T, 'ghost')}>Download</button>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: T.textMuted, lineHeight: 1.7 }}>{imageResult}</pre>
                    </div>
                  )}
                </div>
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Stock direction library</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {stockAssets.filter(asset => asset.kind !== 'music').map(asset => <AssetCard key={asset.id} T={T} asset={asset} />)}
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'chat' && (
            <div className="studio-grid-2">
              <div style={panelStyle(T, { padding: 22 })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 28 }}>LUMI copilot</h1>
                    <div style={{ color: T.textMuted, fontSize: 13, marginTop: 4 }}>Creative direction, pipeline planning, prompts, and production support.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button onClick={() => setUseOllama(false)} style={buttonStyle(T, useOllama ? 'ghost' : 'primary')}>Cloud</button>
                    <button onClick={() => setUseOllama(true)} style={buttonStyle(T, useOllama ? 'primary' : 'ghost')}>Local{isOllamaUp ? '' : ' offline'}</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  {useOllama && (
                    <select value={selectedOllamaModel} onChange={event => setSelectedOllamaModel(event.target.value)} style={inputStyle(T, { width: 240 })}>
                      <option value="gemma3:27b">SuperGemma 26B</option>
                      <option value="gemma3:12b">Gemma 3 12B</option>
                      <option value="gemma3:4b">Gemma 3 4B</option>
                      <option value="llama3.1:8b">Llama 3.1 8B</option>
                      {availableOllamaModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                    </select>
                  )}
                  <select value={chatDomain} onChange={event => setChatDomain(event.target.value)} style={inputStyle(T, { width: 220 })}>
                    <option value="default">General</option>
                    <option value="video">Video</option>
                    <option value="music">Music</option>
                    <option value="game">Game</option>
                    <option value="code">Code</option>
                    <option value="creative">Creative</option>
                  </select>
                </div>
                <div className="studio-scroll" style={{ ...panelStyle(T, { padding: 16, background: T.panelSoft, boxShadow: 'none', minHeight: 420, maxHeight: 560, overflowY: 'auto' }) }}>
                  {chatHistory.length === 0 && <div style={{ color: T.textSoft, fontSize: 13 }}>Ask LUMI to plan a launch campaign, generate a storyboard, write prompts, or architect code.</div>}
                  <div className="studio-list">
                    {chatHistory.map((message, index) => (
                      <div key={`${message.role}-${index}`} style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '88%', padding: '14px 16px', borderRadius: 20, background: message.role === 'user' ? T.accentGradient : T.panel, color: message.role === 'user' ? '#fff' : T.text, border: message.role === 'user' ? 'none' : `1px solid ${T.border}` }}>
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14 }}>{message.content}</div>
                          {message.model && <div style={{ marginTop: 8, color: message.role === 'user' ? 'rgba(255,255,255,0.78)' : T.textSoft, fontSize: 11 }}>{message.model}</div>}
                        </div>
                      </div>
                    ))}
                    {loadingChat && <div style={{ color: T.textSoft, fontSize: 13 }}>LUMI is thinking…</div>}
                    <div ref={chatEndRef} />
                  </div>
                </div>
                <form onSubmit={sendChat} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                  <textarea value={chatInput} onChange={event => setChatInput(event.target.value)} rows={3} style={inputStyle(T)} placeholder='Ask LUMI anything about video, music, image prompts, launch plans, or code…' />
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button type="submit" disabled={loadingChat || !chatInput.trim()} style={buttonStyle(T, 'primary', loadingChat || !chatInput.trim())}>{loadingChat ? 'Sending…' : 'Send to LUMI'}</button>
                    {chatHistory.length > 0 && <button type="button" onClick={() => setChatHistory([])} style={buttonStyle(T, 'ghost')}>Clear chat</button>}
                  </div>
                </form>
              </div>
              <div style={{ display: 'grid', gap: 18 }}>
                <div style={panelStyle(T, { padding: 18 })}>
                  <h2 style={sectionTitleStyle(T)}>Suggested asks</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {['Plan a homepage redesign inspired by Runway.', 'Write a storyboard for a studio launch trailer.', 'Generate prompt variations for luxury product key art.', 'Draft a rollout strategy for a new music video release.'].map(prompt => (
                      <button key={prompt} onClick={() => setChatInput(prompt)} style={{ ...buttonStyle(T, 'ghost'), textAlign: 'left' }}>{prompt}</button>
                    ))}
                  </div>
                </div>
                <div style={panelStyle(T, { padding: 18 })}>
                  <h2 style={sectionTitleStyle(T)}>Local AI</h2>
                  <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.7, marginTop: 12 }}>{isOllamaUp ? `Ollama online at ${ollamaStatus?.host}` : (ollamaStatus?.installHint || 'Run Ollama locally to use offline creative workflows.')}</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'code' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 22 })}>
                  <h1 style={{ margin: 0, fontSize: 30 }}>Code & docs workspace</h1>
                  <p style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.7, margin: '10px 0 18px' }}>Generate UI components, backend workers, launch documentation, and production-ready snippets from the same premium shell.</p>
                  <form onSubmit={generateCode} style={{ display: 'grid', gap: 14 }}>
                    <textarea value={codePrompt} onChange={event => setCodePrompt(event.target.value)} rows={6} style={inputStyle(T)} placeholder='Describe what you want to build…' />
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <select value={codeLanguage} onChange={event => setCodeLanguage(event.target.value)} style={inputStyle(T, { width: 240 })}>
                        {CODE_LANGUAGES.map(language => <option key={language} value={language}>{language}</option>)}
                      </select>
                      <button type="submit" disabled={generatingCode || !codePrompt.trim()} style={buttonStyle(T, 'primary', generatingCode || !codePrompt.trim())}>{generatingCode ? 'Generating…' : 'Generate code'}</button>
                    </div>
                  </form>
                </div>
                <div style={panelStyle(T, { padding: 18 })}>
                  <h2 style={sectionTitleStyle(T)}>Starter prompts</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {codePresets.map(template => <TemplateCard key={template.id} T={T} template={template} />)}
                  </div>
                </div>
              </section>
              <section style={panelStyle(T, { padding: 20 })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  <h2 style={sectionTitleStyle(T)}>Output</h2>
                  {codeResult && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={() => void copyText(codeResult)} style={buttonStyle(T, 'ghost')}>Copy</button>
                      <button onClick={() => downloadTextFile(codeResult, 'lumi-output.txt')} style={buttonStyle(T, 'secondary')}>Download</button>
                    </div>
                  )}
                </div>
                <div style={{ ...panelStyle(T, { padding: 16, background: T.panelSoft, boxShadow: 'none', minHeight: 360 }) }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto', color: codeResult ? T.text : T.textSoft, lineHeight: 1.7 }}>{codeResult || 'Generated code, docs, or scripts will appear here.'}</pre>
                </div>
              </section>
            </div>
          )}

          {tab === 'settings' && (
            <div style={{ display: 'grid', gap: 18 }}>
              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 22 })}>
                  <h1 style={{ margin: 0, fontSize: 30 }}>Settings & provider directory</h1>
                  <p style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.7, margin: '10px 0 18px' }}>Manage your AI provider keys, see what is configured, and keep the studio connected to higher-quality media generation.</p>
                  <form onSubmit={saveUserKey} style={{ display: 'grid', gap: 14 }}>
                    <div className="studio-grid-3">
                      <select value={addKeyProvider} onChange={event => setAddKeyProvider(event.target.value)} style={inputStyle(T)}>
                        <option value="openrouter">OpenRouter</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="google">Google AI</option>
                      </select>
                      <input type="password" value={addKeyValue} onChange={event => setAddKeyValue(event.target.value)} style={inputStyle(T)} placeholder='API key' />
                      <input value={addKeyLabel} onChange={event => setAddKeyLabel(event.target.value)} style={inputStyle(T)} placeholder='Optional label' />
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button type="submit" disabled={addKeyLoading || !addKeyValue.trim()} style={buttonStyle(T, 'primary', addKeyLoading || !addKeyValue.trim())}>{addKeyLoading ? 'Saving…' : 'Save key'}</button>
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: T.accent2, fontWeight: 700, textDecoration: 'none' }}>Get OpenRouter key →</a>
                    </div>
                    {addKeyMsg && <div style={{ color: addKeyMsg.startsWith('⚠️') ? T.danger : T.success, fontSize: 13 }}>{addKeyMsg}</div>}
                  </form>
                </div>
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Configured keys</h2>
                  <div className="studio-list" style={{ marginTop: 14 }}>
                    {(userKeys?.providers.filter(provider => provider.configured) ?? []).length === 0 && <div style={{ color: T.textSoft, fontSize: 13 }}>No provider keys saved yet.</div>}
                    {(userKeys?.providers.filter(provider => provider.configured) ?? []).map(provider => (
                      <div key={provider.provider} style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div>
                            <strong style={{ color: T.text }}>{provider.name}</strong>
                            <div style={{ color: T.textSoft, fontSize: 12, marginTop: 4 }}>{provider.key_preview}</div>
                          </div>
                          <button onClick={() => removeUserKey(provider.provider)} style={buttonStyle(T, 'danger')}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="studio-grid-3">
                {(userKeys?.providers ?? []).map(provider => (
                  <div key={provider.provider} className="card-hover" style={panelStyle(T, { padding: 18 })}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                      <div>
                        <div style={{ color: T.text, fontWeight: 800 }}>{provider.name}</div>
                        <div style={{ color: T.textSoft, fontSize: 12, marginTop: 4 }}>{provider.cost}</div>
                      </div>
                      <span style={badgeStyle(T, provider.configured ? 'configured' : provider.recommended ? 'recommended' : 'available')}>{provider.configured ? 'Configured' : provider.recommended ? 'Recommended' : 'Available'}</span>
                    </div>
                    <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.7, margin: '12px 0 14px' }}>{provider.description}</p>
                    <a href={provider.get_key_url} target="_blank" rel="noreferrer" style={{ color: T.accent2, fontWeight: 700, textDecoration: 'none' }}>Get key →</a>
                  </div>
                ))}
              </section>

              <section className="studio-grid-2">
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Local AI</h2>
                  <div className="studio-grid-3" style={{ marginTop: 14 }}>
                    <div style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                      <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Status</div>
                      <div style={{ color: isOllamaUp ? T.success : T.danger, fontSize: 22, fontWeight: 900, marginTop: 8 }}>{isOllamaUp ? 'Running' : 'Offline'}</div>
                      <div style={{ color: T.textMuted, fontSize: 12, marginTop: 6 }}>{ollamaStatus?.host ?? 'http://localhost:11434'}</div>
                    </div>
                    <div style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                      <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Models</div>
                      <div style={{ color: T.text, fontSize: 22, fontWeight: 900, marginTop: 8 }}>{ollamaStatus?.localModels.length ?? 0}</div>
                      <div style={{ color: T.textMuted, fontSize: 12, marginTop: 6 }}>{(ollamaStatus?.localModels ?? []).map(model => model.name).join(', ') || 'No local models yet'}</div>
                    </div>
                    <div style={{ ...panelStyle(T, { padding: 14, background: T.panelSoft, boxShadow: 'none' }) }}>
                      <div style={{ color: T.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Recommended</div>
                      <div style={{ color: T.text, fontSize: 22, fontWeight: 900, marginTop: 8 }}>Gemma</div>
                      <div style={{ color: T.textMuted, fontSize: 12, marginTop: 6 }}>Pull gemma3:27b for the best local studio experience.</div>
                    </div>
                  </div>
                </div>
                <div style={panelStyle(T, { padding: 20 })}>
                  <h2 style={sectionTitleStyle(T)}>Setup notes</h2>
                  <div style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.8, marginTop: 12 }}>
                    {ollamaStatus?.installHint || 'Download Ollama, run ollama serve, then pull gemma3:27b to enable local creative workflows.'}
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
