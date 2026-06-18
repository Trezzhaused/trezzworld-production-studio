import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

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
interface OllamaModel { id: string; family: string; label: string; available: boolean; }
interface OllamaStatus { available: boolean; host: string; localModels: Array<{ name: string }>; catalogue: OllamaModel[]; superGemmaReady: boolean; installHint: string; }
interface VideoStoryboardScene { id: string; title: string; duration_seconds: number; visual_description: string; text_overlay?: string; transition_in: string; transition_out: string; camera_motion: string; color_grade: string; }
interface VideoStoryboard { title?: string; logline?: string; style?: string; total_duration_seconds?: number; color_palette?: string[]; audio?: Record<string, unknown>; scenes?: VideoStoryboardScene[]; }
interface VideoJob { jobId: string; concept: string; durationSeconds: number; style: string; resolution: string; fps: number; status: string; progress: number; message: string; storyboard: VideoStoryboard; outputPath: string | null; downloadReady: boolean; error: string | null; createdAt: number; }

interface MusicJob { jobId: string; concept: string; genre: string; bpm: number; mood: string; durationSeconds: number; status: string; progress: number; message: string; outputPath: string | null; outputFormat: string | null; compositionBrief: string; provider: string; downloadReady: boolean; error: string | null; createdAt: number; }
interface ImageRenderResult { ok: boolean; provider: string; model: string; imageBase64: string | null; format: string | null; message: string; }

type Tab = 'home' | 'music' | 'video' | 'image' | 'chat' | 'code' | 'settings';
type MusicSubTab = 'musicvideo' | 'audio';
interface UserKeyEntry { provider: string; name: string; description: string; cost: string; get_key_url: string; recommended: boolean; configured: boolean; key_preview?: string; added_at?: string; }
interface UserKeysResponse { providers: UserKeyEntry[]; configured_count: number; }

// Use same-origin when deployed to Railway/Cloudflare; keep localhost:8000 in local dev.
const API = (window.location.port === '5173' || window.location.port === '3000')
  ? 'http://localhost:8000'
  : '';

// ─── Theme ────────────────────────────────────────────────────────────────────

interface ThemeTokens {
  bg: string; sidebar: string; sidebarBorder: string;
  card: string; cardAlt: string; border: string; borderAccent: string;
  text: string; textMuted: string; textSubtle: string;
  accent: string; accentGrad: string; accentBtn: string;
  accentCyan: string; green: string; red: string; yellow: string;
  inputBg: string; inputBorder: string; inputColor: string;
  scrollTrack: string;
}

const dark: ThemeTokens = {
  bg: '#08091a', sidebar: '#0e0f22', sidebarBorder: 'rgba(139,92,246,0.14)',
  card: '#12142a', cardAlt: '#1a1c38', border: 'rgba(148,163,184,0.1)', borderAccent: 'rgba(139,92,246,0.22)',
  text: '#e2e8f5', textMuted: '#8892a4', textSubtle: '#4a5568',
  accent: '#7c3aed', accentGrad: 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)', accentBtn: '#7c3aed',
  accentCyan: '#38bdf8', green: '#22c55e', red: '#ef4444', yellow: '#f59e0b',
  inputBg: '#08091a', inputBorder: 'rgba(148,163,184,0.15)', inputColor: '#e2e8f5',
  scrollTrack: 'rgba(255,255,255,0.04)',
};

const light: ThemeTokens = {
  bg: '#f4f4f8', sidebar: '#ffffff', sidebarBorder: 'rgba(0,0,0,0.09)',
  card: '#ffffff', cardAlt: '#f8f7ff', border: 'rgba(0,0,0,0.08)', borderAccent: 'rgba(124,58,237,0.22)',
  text: '#111827', textMuted: '#6b7280', textSubtle: '#9ca3af',
  accent: '#7c3aed', accentGrad: 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%)', accentBtn: '#7c3aed',
  accentCyan: '#0284c7', green: '#16a34a', red: '#dc2626', yellow: '#d97706',
  inputBg: '#fafafa', inputBorder: 'rgba(0,0,0,0.14)', inputColor: '#111827',
  scrollTrack: 'rgba(0,0,0,0.04)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s/60)}m ${s % 60 > 0 ? `${s%60}s` : ''}`.trim() : `${s}s`;
const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
};
const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
};

// ─── Style builders (theme-aware) ─────────────────────────────────────────────

const mkCard = (T: ThemeTokens, extra?: React.CSSProperties): React.CSSProperties => ({
  background: T.card, borderRadius: '16px', padding: '20px',
  border: `1px solid ${T.border}`, boxShadow: T === dark ? '0 8px 28px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.07)',
  ...extra,
});
const mkInput = (T: ThemeTokens): React.CSSProperties => ({
  background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: '10px',
  color: T.inputColor, padding: '10px 14px', fontSize: '14px', width: '100%',
  outline: 'none', boxSizing: 'border-box',
});
const mkSelect = (T: ThemeTokens): React.CSSProperties => ({ ...mkInput(T), width: 'auto', minWidth: '150px' });
const mkTextarea = (T: ThemeTokens): React.CSSProperties => ({ ...mkInput(T), resize: 'vertical' as const });
const mkLabel = (T: ThemeTokens): React.CSSProperties => ({ fontSize: '12px', fontWeight: 600, color: T.textMuted, marginBottom: '5px', display: 'block' });
const mkHint = (T: ThemeTokens): React.CSSProperties => ({ fontSize: '12px', color: T.textSubtle, margin: '4px 0 0' });
const mkBtn = (T: ThemeTokens, variant: 'primary'|'gradient'|'secondary'|'danger' = 'primary', disabled = false): React.CSSProperties => ({
  background: disabled
    ? (T === dark ? '#1a2040' : '#e5e7eb')
    : variant === 'gradient' ? T.accentGrad
    : variant === 'primary' ? T.accentBtn
    : variant === 'danger' ? T.red
    : (T === dark ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.08)'),
  color: disabled ? T.textSubtle : variant === 'secondary' ? T.accent : '#ffffff',
  border: variant === 'secondary' ? `1px solid ${T.borderAccent}` : 'none',
  borderRadius: '10px', padding: '10px 20px', fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '14px',
  transition: 'opacity 0.15s', opacity: disabled ? 0.6 : 1,
});

const pill = (status: string, T: ThemeTokens): React.CSSProperties => ({
  display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
  background: ['active','ready','running','done'].includes(status) ? `rgba(34,197,94,0.18)` : ['in-progress','standby','scheduled'].includes(status) ? `rgba(250,204,21,0.18)` : ['error','failed'].includes(status) ? `rgba(239,68,68,0.18)` : `rgba(148,163,184,0.14)`,
  color: ['active','ready','running','done'].includes(status) ? T.green : ['in-progress','standby','scheduled'].includes(status) ? T.yellow : ['error','failed'].includes(status) ? T.red : T.textMuted,
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ pct, status, T }: { pct: number; status: string; T: ThemeTokens }) {
  const col = status === 'done' || status === 'completed' ? T.green : status === 'error' || status === 'failed' ? T.red : T.accentCyan;
  return (
    <div style={{ height: '5px', background: T.scrollTrack, borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: '999px', transition: 'width 0.5s ease' }} />
    </div>
  );
}

function StatusDot({ ok, T }: { ok: boolean; T: ThemeTokens }) {
  return <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: ok ? T.green : T.textSubtle, marginRight: '5px', flexShrink: 0 }} />;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'home',     icon: '🏠', label: 'Home' },
  { id: 'music',    icon: '🎵', label: 'Music Studio' },
  { id: 'video',    icon: '🎥', label: 'Video Editor' },
  { id: 'image',    icon: '🖼', label: 'Image Generator' },
  { id: 'chat',     icon: '💬', label: 'LUMI Chat' },
  { id: 'code',     icon: '💻', label: 'Code Generator' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
];

function Sidebar({ tab, setTab, T, isDark, onToggleDark, isOnline }:
  { tab: Tab; setTab: (t: Tab) => void; T: ThemeTokens; isDark: boolean; onToggleDark: () => void; isOnline: boolean }) {
  return (
    <aside style={{ width: '220px', minHeight: '100vh', background: T.sidebar, borderRight: `1px solid ${T.sidebarBorder}`, display: 'flex', flexDirection: 'column', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50, flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '22px 20px 18px', borderBottom: `1px solid ${T.sidebarBorder}` }}>
        <div style={{ fontSize: '19px', fontWeight: 900, background: T.accentGrad, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.5px' }}>TrezzWorld</div>
        <div style={{ fontSize: '11px', color: T.textSubtle, marginTop: '2px', fontWeight: 500 }}>Production Studio</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const active = tab === item.id;
          return (
            <button key={item.id} onClick={() => setTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%', padding: '11px 20px', background: active ? (isDark ? 'rgba(124,58,237,0.16)' : 'rgba(124,58,237,0.08)') : 'transparent', color: active ? T.accent : T.textMuted, border: 'none', borderLeft: `3px solid ${active ? T.accent : 'transparent'}`, cursor: 'pointer', fontSize: '13px', fontWeight: active ? 700 : 400, textAlign: 'left', transition: 'background 0.15s, color 0.15s' }}>
              <span style={{ fontSize: '15px', width: '18px', textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom controls */}
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.sidebarBorder}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: T.textMuted }}>
          <StatusDot ok={isOnline} T={T} />
          <span style={{ fontWeight: 500 }}>{isOnline ? 'Studio Online' : 'Studio Offline'}</span>
        </div>
        <button onClick={onToggleDark} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: `1px solid ${T.sidebarBorder}`, borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: T.text, fontSize: '12px', fontWeight: 600, width: '100%' }}>
          <span>{isDark ? '☀️' : '🌙'}</span>
          <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // Theme
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? dark : light;

  // Navigation
  const [tab, setTab] = useState<Tab>('home');
  const [musicSubTab, setMusicSubTab] = useState<MusicSubTab>('musicvideo');

  // Backend data
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaDevelopmentStatus | null>(null);
  const [metaBuilderStatus, setMetaBuilderStatus] = useState<MetaBuilderStatus | null>(null);
  const [controlPlane, setControlPlane] = useState<ControlPlaneStatus | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);

  // Mission
  const [missionPrompt, setMissionPrompt] = useState('Build a Roblox game called TrezzWorld Adventures, create original 3D assets, music, voice acting, a 5-minute cinematic trailer, website, documentation, marketing campaign, and prepare everything for publishing.');
  const [missionBoot, setMissionBoot] = useState<MissionBootResult | null>(null);
  const [loadingMission, setLoadingMission] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [useOllama, setUseOllama] = useState(false);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState('gemma3:27b');
  const [chatDomain, setChatDomain] = useState('default');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Video
  const [videoConcept, setVideoConcept] = useState('');
  const [videoDuration, setVideoDuration] = useState(60);
  const [videoStyle, setVideoStyle] = useState('cinematic');
  const [videoResolution, setVideoResolution] = useState('1080p');
  const [videoFps, setVideoFps] = useState(24);
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const videoPolls = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Music — brief + real audio
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

  // Image — prompts + real render
  const [imageConcept, setImageConcept] = useState('');
  const [imageStyle, setImageStyle] = useState('photorealistic');
  const [imageAspect, setImageAspect] = useState('16:9');
  const [imageCount, setImageCount] = useState(4);
  const [imageResult, setImageResult] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageRenderPrompt, setImageRenderPrompt] = useState('');
  const [imageRenderResult, setImageRenderResult] = useState<ImageRenderResult | null>(null);
  const [renderingImage, setRenderingImage] = useState(false);

  // Code
  const [codePrompt, setCodePrompt] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('typescript');
  const [codeResult, setCodeResult] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);

  // User API key management
  const [userKeys, setUserKeys] = useState<UserKeysResponse | null>(null);
  const [addKeyProvider, setAddKeyProvider] = useState('openrouter');
  const [addKeyValue, setAddKeyValue] = useState('');
  const [addKeyLabel, setAddKeyLabel] = useState('');
  const [addKeyLoading, setAddKeyLoading] = useState(false);
  const [addKeyMsg, setAddKeyMsg] = useState('');

  // Music Video creation
  const [mvSongName, setMvSongName] = useState('');
  const [mvPhotos, setMvPhotos] = useState<string[]>([]);
  const [mvDescription, setMvDescription] = useState('');
  const [mvTitle, setMvTitle] = useState('');
  const [mvAuthor, setMvAuthor] = useState('');
  const [mvStyle, setMvStyle] = useState('music video');
  const [mvDuration, setMvDuration] = useState(120);
  const [creatingMv, setCreatingMv] = useState(false);

  // Video quick prompt (Descript-style)
  const [videoQuickPrompt, setVideoQuickPrompt] = useState('');

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.allSettled([
      fetchJson<BackendStatus>(`${API}/api/status`, ctrl.signal),
      fetchJson<MetaDevelopmentStatus>(`${API}/api/meta-development/status`, ctrl.signal),
      fetchJson<MetaBuilderStatus>(`${API}/api/meta-builder/status`, ctrl.signal),
      fetchJson<ControlPlaneStatus>(`${API}/api/studio/control-plane`, ctrl.signal),
      fetchJson<{ available: boolean; host: string; localModels: Array<{name:string}>; catalogue: OllamaModel[]; superGemmaReady: boolean; installHint: string }>(`${API}/api/ollama/status`, ctrl.signal),
      fetchJson<UserKeysResponse>(`${API}/api/lumi/user-keys`, ctrl.signal),
    ]).then(([bk, meta, mb, cp, ol, keys]) => {
      if (bk.status === 'fulfilled') setBackendStatus(bk.value);
      if (meta.status === 'fulfilled') setMetaStatus(meta.value);
      if (mb.status === 'fulfilled') setMetaBuilderStatus(mb.value);
      if (cp.status === 'fulfilled') setControlPlane(cp.value);
      if (ol.status === 'fulfilled') setOllamaStatus(ol.value);
      if (keys.status === 'fulfilled') setUserKeys(keys.value);
    });
    return () => ctrl.abort();
  }, []);

  // ── Pipeline polling ───────────────────────────────────────────────────────
  const startPolling = useCallback((missionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchJson<PipelineStatus>(`${API}/api/pipeline/${encodeURIComponent(missionId)}/status`);
        setPipelineStatus(data);
        if (data.status === 'completed' || data.status === 'failed') { clearInterval(pollRef.current!); pollRef.current = null; }
      } catch { /* backend offline */ }
    }, 2500);
  }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Chat scroll ────────────────────────────────────────────────────────────
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  // ── Video job polling ──────────────────────────────────────────────────────
  const pollVideoJob = useCallback((jobId: string) => {
    if (videoPolls.current.has(jobId)) return;
    const timer = setInterval(async () => {
      try {
        const job = await fetchJson<VideoJob>(`${API}/api/video/${jobId}/status`);
        setVideoJobs(prev => { const next = [...prev]; const idx = next.findIndex(j => j.jobId === jobId); if (idx >= 0) next[idx] = job; else next.unshift(job); return next; });
        if (job.status === 'done' || job.status === 'error') { clearInterval(timer); videoPolls.current.delete(jobId); }
      } catch { clearInterval(timer); videoPolls.current.delete(jobId); }
    }, 3000);
    videoPolls.current.set(jobId, timer);
  }, []);
  useEffect(() => () => { videoPolls.current.forEach(t => clearInterval(t)); }, []);

  // ── Music job polling ──────────────────────────────────────────────────────
  const pollMusicJob = useCallback((jobId: string) => {
    if (musicPolls.current.has(jobId)) return;
    const timer = setInterval(async () => {
      try {
        const job = await fetchJson<MusicJob>(`${API}/api/music/${jobId}/status`);
        setMusicJobs(prev => { const next = [...prev]; const idx = next.findIndex(j => j.jobId === jobId); if (idx >= 0) next[idx] = job; else next.unshift(job); return next; });
        if (job.status === 'done' || job.status === 'error') { clearInterval(timer); musicPolls.current.delete(jobId); }
      } catch { clearInterval(timer); musicPolls.current.delete(jobId); }
    }, 3000);
    musicPolls.current.set(jobId, timer);
  }, []);
  useEffect(() => () => { musicPolls.current.forEach(t => clearInterval(t)); }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const bootMission = async (e: FormEvent) => {
    e.preventDefault();
    setLoadingMission(true);
    try {
      const payload = await postJson<MissionBootResult>(`${API}/api/studio/control-plane/boot`, { prompt: missionPrompt });
      setMissionBoot(payload);
      if (payload.missionId) { setActiveMissionId(payload.missionId); startPolling(payload.missionId); }
    } catch { setMissionBoot(null); } finally { setLoadingMission(false); }
  };

  const sendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    const requestHistory = [...chatHistory.slice(-20), userMsg].map(m => ({ role: m.role, content: m.content }));
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setLoadingChat(true);
    try {
      const data = await postJson<{ content: string; model: string; ok: boolean }>(`${API}/api/lumi/chat`, {
        message: userMsg.content,
        missionId: activeMissionId,
        history: requestHistory,
        useOllama,
        ollamaModel: useOllama ? selectedOllamaModel : null,
        domain: chatDomain === 'default' ? null : chatDomain,
      });
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.content, model: data.model }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: '⚠️ LUMI unavailable. Start backend + set OPENROUTER_API_KEY (or start Ollama).' }]);
    } finally { setLoadingChat(false); }
  };

  const startVideoCreation = async (e: FormEvent) => {
    e.preventDefault();
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
    } catch { alert('Failed to start video creation. Is the backend running?'); }
    finally { setCreatingVideo(false); }
  };

  const startMusicCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicConcept.trim()) return;
    setCreatingMusicJob(true);
    try {
      const job = await postJson<MusicJob>(`${API}/api/music/create`, {
        concept: musicConcept, genre: musicGenre, bpm: musicBpm, mood: musicMood, durationSeconds: musicDuration,
      });
      setMusicJobs(prev => [job, ...prev]);
      pollMusicJob(job.jobId);
    } catch { alert('Failed to start music creation. Is the backend running?'); }
    finally { setCreatingMusicJob(false); }
  };

  const renderRealImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageRenderPrompt.trim()) return;
    setRenderingImage(true);
    setImageRenderResult(null);
    try {
      const data = await postJson<ImageRenderResult>(`${API}/api/image/render`, {
        prompt: imageRenderPrompt, style: imageStyle, width: 1024, height: 576,
      });
      setImageRenderResult(data);
    } catch { setImageRenderResult({ ok: false, provider: 'none', model: 'none', imageBase64: null, format: null, message: '⚠️ Image render failed. Is the backend running?' }); }
    finally { setRenderingImage(false); }
  };


  const generateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicConcept.trim()) return;
    setGeneratingMusic(true);
    setMusicResult('');
    try {
      const data = await postJson<{ composition: string; model: string; ok: boolean }>(`${API}/api/music/generate`, {
        concept: musicConcept, genre: musicGenre, bpm: musicBpm, mood: musicMood, durationSeconds: musicDuration,
      });
      setMusicResult(data.composition);
    } catch { setMusicResult('⚠️ Music generation failed. Is the backend running with OPENROUTER_API_KEY set?'); }
    finally { setGeneratingMusic(false); }
  };

  const generateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageConcept.trim()) return;
    setGeneratingImage(true);
    setImageResult('');
    try {
      const data = await postJson<{ output: string; model: string; ok: boolean }>(`${API}/api/image/generate`, {
        concept: imageConcept, style: imageStyle, aspectRatio: imageAspect, count: imageCount,
      });
      setImageResult(data.output);
    } catch { setImageResult('⚠️ Image prompt generation failed. Is the backend running?'); }
    finally { setGeneratingImage(false); }
  };

  const generateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codePrompt.trim()) return;
    setGeneratingCode(true);
    setCodeResult('');
    try {
      const data = await postJson<{ content: string; model: string; ok: boolean }>(`${API}/api/lumi/chat`, {
        message: `Generate complete, production-ready ${codeLanguage} code for:\n${codePrompt}\n\nProvide well-commented, clean, runnable code with no placeholders.`,
        domain: 'code',
      });
      setCodeResult(data.content);
    } catch { setCodeResult('⚠️ Code generation failed. Is the backend running with OPENROUTER_API_KEY set?'); }
    finally { setGeneratingCode(false); }
  };

  const saveUserKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!addKeyValue.trim()) return;
    setAddKeyLoading(true);
    setAddKeyMsg('');
    try {
      const data = await postJson<{ ok: boolean; message: string }>(`${API}/api/lumi/user-key`, {
        provider: addKeyProvider,
        api_key: addKeyValue.trim(),
        label: addKeyLabel.trim(),
      });
      setAddKeyMsg(data.message);
      setAddKeyValue('');
      const fresh = await fetchJson<UserKeysResponse>(`${API}/api/lumi/user-keys`);
      setUserKeys(fresh);
    } catch { setAddKeyMsg('⚠️ Failed to save key. Is the backend running?'); }
    finally { setAddKeyLoading(false); }
  };

  const removeUserKey = async (provider: string) => {
    try {
      await fetch(`${API}/api/lumi/user-key/${provider}`, { method: 'DELETE' });
      const fresh = await fetchJson<UserKeysResponse>(`${API}/api/lumi/user-keys`);
      setUserKeys(fresh);
    } catch { /* ignore */ }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const activeQueue = pipelineStatus?.jobs ?? missionBoot?.executionQueue ?? controlPlane?.executionQueue ?? [];
  const readiness = controlPlane?.productionReadiness.score ?? metaStatus?.productionReadiness.score ?? 0;
  const pipelinePct = pipelineStatus?.progress.percent ?? 0;
  const isBackendUp = !!backendStatus;
  const isOllamaUp = ollamaStatus?.available ?? false;
  const availableOllamaModels = ollamaStatus?.catalogue.filter(m => m.available) ?? [];
  const mvJobs = videoJobs.filter(j => j.style === 'music video');

  // ── Handlers: Music Video & Quick Video ───────────────────────────────────

  const createMusicVideo = async (e: FormEvent) => {
    e.preventDefault();
    const concept = [
      mvSongName ? `Music video for "${mvSongName}".` : 'Untitled music video.',
      mvDescription.trim(),
      mvTitle ? `Title: ${mvTitle}.` : '',
      mvAuthor ? `By: ${mvAuthor}.` : '',
      'Create cinematic visuals synchronized to the music — emotive scenes, dynamic cuts, and stunning visual effects.',
    ].filter(Boolean).join(' ');
    setCreatingMv(true);
    try {
      const job = await postJson<VideoJob>(`${API}/api/video/create`, {
        concept, durationSeconds: mvDuration, style: 'music video', resolution: '1080p', fps: 24,
      });
      setVideoJobs(prev => [job, ...prev]);
      pollVideoJob(job.jobId);
    } catch { alert('Failed to start Music Video creation. Is the backend running?'); }
    finally { setCreatingMv(false); }
  };

  const startQuickVideo = async (e: FormEvent) => {
    e.preventDefault();
    if (!videoQuickPrompt.trim() && !videoConcept.trim()) return;
    const concept = videoQuickPrompt.trim() || videoConcept.trim();
    setCreatingVideo(true);
    try {
      const job = await postJson<VideoJob>(`${API}/api/video/create`, {
        concept, durationSeconds: videoDuration, style: videoStyle, resolution: videoResolution, fps: videoFps,
      });
      setVideoJobs(prev => [job, ...prev]);
      pollVideoJob(job.jobId);
      setVideoQuickPrompt('');
    } catch { alert('Failed to start video creation. Is the backend running?'); }
    finally { setCreatingVideo(false); }
  };

  // ── Common section styles ──────────────────────────────────────────────────
  const pageWrap: React.CSSProperties = { maxWidth: '1320px', margin: '0 auto', padding: '28px 32px', display: 'grid', gap: '20px' };
  const sectionCard = (extra?: React.CSSProperties) => mkCard(T, extra);
  const heroCard: React.CSSProperties = { ...mkCard(T), background: isDark ? 'linear-gradient(135deg,#14163a 0%,#1e1060 100%)' : 'linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)', border: `1px solid ${T.borderAccent}` };
  const H2: React.CSSProperties = { margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: T.text };
  const listRow: React.CSSProperties = { padding: '12px 14px', background: isDark ? 'rgba(10,12,30,0.6)' : 'rgba(248,247,255,0.8)', borderRadius: '12px', border: `1px solid ${T.border}` };
  const autoGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: '14px' };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg, color: T.text, fontFamily: '"Inter", system-ui, sans-serif' }}>
      <Sidebar tab={tab} setTab={setTab} T={T} isDark={isDark} onToggleDark={() => setIsDark(d => !d)} isOnline={isBackendUp} />

      {/* Main content area */}
      <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', overflowY: 'auto' }}>

        {/* ── HOME / STUDIO ─────────────────────────────────────────── */}
        {tab === 'home' && (
          <div style={pageWrap}>
            {/* Hero */}
            <section style={heroCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '2px', color: T.accent, textTransform: 'uppercase' }}>LUMI Control Plane</p>
                  <h1 style={{ margin: '0 0 10px', fontSize: '28px', fontWeight: 900, color: T.text }}>{controlPlane?.workspaceTitle ?? 'TrezzWorld Production Studio'}</h1>
                  <p style={{ maxWidth: '740px', lineHeight: 1.65, color: T.textMuted, margin: 0, fontSize: '14px' }}>{controlPlane?.finishLine ?? 'A single prompt produces an end-to-end deliverable — music, video, images, code — with minimal human intervention.'}</p>
                </div>
                <div style={{ ...sectionCard(), background: isDark ? 'rgba(8,9,26,0.7)' : 'rgba(255,255,255,0.8)', minWidth: '160px', padding: '14px 18px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', color: T.textMuted }}>Studio</p>
                  <strong style={{ color: isBackendUp ? T.green : T.red, fontSize: '14px' }}>{isBackendUp ? '✅ Online' : '⚠️ Offline'}</strong>
                  {backendStatus && <p style={{ margin: '3px 0 0', fontSize: '11px', color: T.textSubtle }}>v{backendStatus.version}</p>}
                </div>
              </div>
            </section>

            {/* Stats row */}
            <section style={autoGrid}>
              {[
                { label: 'Production Readiness', value: `${readiness}%`, sub: metaBuilderStatus?.summary ?? 'Analyzing…', icon: '📊' },
                { label: 'Source Files', value: String(metaStatus?.repositoryIntelligence.sourceFiles ?? '—'), sub: `${metaStatus?.repositoryIntelligence.todoMarkers ?? 0} TODO markers`, icon: '📁' },
                { label: 'Autonomy Score', value: `${metaBuilderStatus?.readinessEstimate ?? 0}%`, sub: 'LUMI self-build progress', icon: '🤖' },
                { label: "Next ROI Move", value: '', sub: metaStatus?.highestRoiNextMove ?? 'Waiting for backend…', icon: '🚀' },
              ].map(s => (
                <div key={s.label} style={sectionCard()}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.textMuted }}>{s.icon} {s.label}</p>
                  {s.value !== '' && <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 800, color: T.text }}>{s.value}</h2>}
                  <p style={{ margin: 0, color: T.textMuted, fontSize: '13px', lineHeight: 1.5 }}>{s.sub}</p>
                </div>
              ))}
            </section>

            {/* Mission launcher */}
            <section style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '18px', alignItems: 'start' }}>
              <div style={sectionCard()}>
                <h2 style={H2}>🚀 Mission Launcher</h2>
                <form onSubmit={bootMission} style={{ display: 'grid', gap: '14px' }}>
                  <textarea value={missionPrompt} onChange={e => setMissionPrompt(e.target.value)} rows={5} style={mkTextarea(T)} placeholder={controlPlane?.missionPromptPlaceholder ?? 'Describe your mission…'} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <p style={{ margin: 0, color: T.textMuted, fontSize: '13px' }}>
                      {missionBoot ? `🚀 Mission ${missionBoot.missionId ?? ''} is ${missionBoot.status} via ${missionBoot.plannerModel ?? 'cascade'}.` : 'LUMI will plan and execute real pipeline tasks.'}
                      {pipelineStatus?.status === 'running' && <span style={{ color: T.accentCyan }}> ⚡ {pipelineStatus.progress.completed}/{pipelineStatus.progress.total} jobs</span>}
                    </p>
                    <button type="submit" disabled={loadingMission} style={{ ...mkBtn(T, 'gradient', loadingMission), padding: '11px 22px', borderRadius: '10px' }}>
                      {loadingMission ? 'Booting…' : 'Boot LUMI Mission'}
                    </button>
                  </div>
                  {pipelineStatus && (
                    <div>
                      <ProgressBar pct={pipelinePct} status={pipelineStatus.status} T={T} />
                      <p style={{ ...mkHint(T), marginTop: '5px' }}>{pipelineStatus.progress.completed} done · {pipelineStatus.progress.running} running · {pipelineStatus.progress.errored} errors</p>
                    </div>
                  )}
                </form>
              </div>
              <div style={{ ...sectionCard(), minWidth: '220px' }}>
                <h2 style={H2}>Delivery Surfaces</h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                  {(controlPlane?.deliverySurfaces ?? []).map(s => (
                    <li key={s.name} style={listRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: T.text }}>{s.name}</strong>
                        <span style={pill(s.status, T)}>{s.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Modules + Queue + Readiness */}
            <section style={autoGrid}>
              <div style={sectionCard()}>
                <h2 style={H2}>Workspace Modules</h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                  {(controlPlane?.workspaceModules ?? []).map(m => (
                    <li key={m.id} style={listRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: T.text }}>{m.name}</strong>
                        <span style={pill(m.status, T)}>{m.status}</span>
                      </div>
                      <p style={{ margin: '5px 0 0', color: T.textMuted, fontSize: '12px' }}>{m.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div style={sectionCard()}>
                <h2 style={H2}>Execution Queue</h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                  {activeQueue.map(j => (
                    <li key={j.jobId ?? j.actionId} style={listRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: T.text }}>{j.name}</strong>
                        <span style={pill(j.status, T)}>{j.status}</span>
                      </div>
                      <p style={{ margin: '4px 0 0', color: T.textMuted, fontSize: '12px' }}>{j.workerId} · {j.stage}{j.score != null ? ` · score ${j.score.toFixed(2)}` : ''}</p>
                      {j.error && <p style={{ margin: '3px 0 0', fontSize: '12px', color: T.red }}>{j.error}</p>}
                    </li>
                  ))}
                  {activeQueue.length === 0 && <p style={{ color: T.textSubtle, fontSize: '13px', margin: 0 }}>No jobs queued. Launch a mission to start.</p>}
                </ul>
              </div>
              <div style={sectionCard()}>
                <h2 style={H2}>Readiness Checks</h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                  {(metaStatus?.productionReadiness.checks ?? []).map(c => (
                    <li key={c.category} style={listRow}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: T.text }}>{c.category}</strong>
                        <span style={pill(c.passed ? 'ready' : 'planned', T)}>{c.passed ? '✓ passed' : 'pending'}</span>
                      </div>
                      <p style={{ margin: '3px 0 0', color: T.textMuted, fontSize: '12px' }}>{c.goal}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        )}

        {/* ── MUSIC STUDIO ──────────────────────────────────────────── */}
        {tab === 'music' && (
          <div style={{ display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden' }}>

            {/* LEFT: Creation panel */}
            <div style={{ width: '460px', minWidth: '360px', maxWidth: '500px', borderRight: `1px solid ${T.border}`, overflowY: 'auto', padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: '0' }}>

              {/* Sub-nav */}
              <div style={{ display: 'flex', gap: '4px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: '10px', padding: '4px', marginBottom: '22px' }}>
                {(['musicvideo', 'audio'] as MusicSubTab[]).map(s => (
                  <button key={s} onClick={() => setMusicSubTab(s)} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: musicSubTab === s ? T.accentGrad : 'transparent', color: musicSubTab === s ? '#fff' : T.textMuted, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}>
                    {s === 'musicvideo' ? '🎬 Music Video' : '🎧 Audio Only'}
                  </button>
                ))}
              </div>

              {/* ── MUSIC VIDEO CREATOR (Sondo-inspired) ── */}
              {musicSubTab === 'musicvideo' && (
                <form onSubmit={createMusicVideo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Choose a Song */}
                  <div style={{ background: isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.05)', border: `1px solid ${T.borderAccent}`, borderRadius: '14px', padding: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: T.accent }}>Choose a song</h3>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input value={mvSongName} onChange={e => setMvSongName(e.target.value)} placeholder="Type song name / artist…" style={{ ...mkInput(T), flex: 1 }} />
                      <label style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: `1px solid ${T.border}`, borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: T.textMuted, flexShrink: 0, lineHeight: 1 }}>
                        <span style={{ fontSize: '18px' }}>⬆</span>
                        <span>Upload</span>
                        <input type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setMvSongName(e.target.files[0].name); }} />
                      </label>
                    </div>
                  </div>

                  {/* Upload Photos */}
                  <div style={{ background: isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.05)', border: `1px solid ${T.borderAccent}`, borderRadius: '14px', padding: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: T.accent }}>Upload photos</h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {mvPhotos.map((p, i) => (
                        <div key={i} style={{ width: '54px', height: '54px', borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                          <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button type="button" onClick={() => setMvPhotos(prev => prev.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer', color: '#fff', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                        </div>
                      ))}
                      <label style={{ width: '54px', height: '54px', borderRadius: '8px', border: `2px dashed ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textMuted, fontSize: '10px', gap: '2px', flexShrink: 0 }}>
                        <span style={{ fontSize: '16px' }}>📁</span>
                        <span>Album</span>
                        <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                          if (e.target.files) {
                            Array.from(e.target.files).forEach(file => {
                              const reader = new FileReader();
                              reader.onload = ev => setMvPhotos(prev => [...prev, ev.target!.result as string]);
                              reader.readAsDataURL(file);
                            });
                          }
                        }} />
                      </label>
                      {mvPhotos.length > 0 && (
                        <button type="button" onClick={() => setMvPhotos([])} style={{ fontSize: '11px', color: T.textSubtle, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>Clear all</button>
                      )}
                    </div>
                  </div>

                  {/* MV Description */}
                  <div style={{ background: isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.05)', border: `1px solid ${T.borderAccent}`, borderRadius: '14px', padding: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: T.accent }}>Music Video Description</h3>
                    <textarea value={mvDescription} onChange={e => setMvDescription(e.target.value.slice(0, 2000))} rows={5} style={{ ...mkTextarea(T), resize: 'none' }} placeholder="Please describe the desired emotions, plot, or visuals for the Music Video. If left blank, AI will create based on your song." />
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: T.textSubtle, textAlign: 'right' }}>{mvDescription.length} / 2000</p>
                  </div>

                  {/* Options */}
                  <details style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${T.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                    <summary style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: T.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center', listStyle: 'none', userSelect: 'none' }}>
                      <span>Options</span>
                      <span style={{ color: T.textSubtle }}>▾</span>
                    </summary>
                    <div style={{ padding: '0 16px 16px', display: 'grid', gap: '12px' }}>
                      <div>
                        <label style={mkLabel(T)}>
                          Music Video Title
                          <span style={{ float: 'right', fontWeight: 400 }}>{mvTitle.length}/30</span>
                        </label>
                        <input value={mvTitle} onChange={e => setMvTitle(e.target.value.slice(0, 30))} placeholder="Enter video title" style={mkInput(T)} />
                      </div>
                      <div>
                        <label style={mkLabel(T)}>
                          Author's Name
                          <span style={{ float: 'right', fontWeight: 400 }}>{mvAuthor.length}/30</span>
                        </label>
                        <input value={mvAuthor} onChange={e => setMvAuthor(e.target.value.slice(0, 30))} placeholder="Enter author name" style={mkInput(T)} />
                      </div>
                      <div>
                        <label style={mkLabel(T)}>Visual Style</label>
                        <select value={mvStyle} onChange={e => setMvStyle(e.target.value)} style={mkSelect(T)}>
                          <option value="music video">Music Video (standard)</option>
                          <option value="cinematic">Cinematic</option>
                          <option value="animated">Animated</option>
                          <option value="lo-fi aesthetic">Lo-fi Aesthetic</option>
                          <option value="epic fantasy">Epic Fantasy</option>
                          <option value="documentary">Documentary Style</option>
                        </select>
                      </div>
                      <div>
                        <label style={mkLabel(T)}>Duration: {fmtDur(mvDuration)}</label>
                        <input type="range" min={15} max={300} step={15} value={mvDuration} onChange={e => setMvDuration(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: T.textSubtle }}><span>15s</span><span>2:30</span><span>5 min</span></div>
                      </div>
                    </div>
                  </details>

                  {/* Generate button */}
                  <button type="submit" disabled={creatingMv} style={{ background: creatingMv ? (isDark ? '#1e1040' : '#e5e0f5') : T.accentGrad, color: creatingMv ? T.textSubtle : '#fff', border: 'none', borderRadius: '999px', padding: '15px 28px', fontSize: '15px', fontWeight: 700, cursor: creatingMv ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '4px' }}>
                    <span>{creatingMv ? '⏳ Generating Music Video…' : '🎬 Generate Script'}</span>
                    {!creatingMv && <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '3px 10px' }}>+ AI Credits</span>}
                  </button>
                </form>
              )}

              {/* ── AUDIO ONLY ── */}
              {musicSubTab === 'audio' && (
                <form onSubmit={startMusicCreation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <h2 style={H2}>🎧 Generate Real Audio</h2>
                    <label style={mkLabel(T)}>Concept / Brief</label>
                    <textarea value={musicConcept} onChange={e => setMusicConcept(e.target.value)} rows={4} style={mkTextarea(T)} placeholder="e.g. Epic orchestral theme for TrezzWorld Adventures — heroic, full brass, driving percussion, cinematic" />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <label style={mkLabel(T)}>Genre</label>
                      <select value={musicGenre} onChange={e => setMusicGenre(e.target.value)} style={mkSelect(T)}>
                        <option value="cinematic">Cinematic / Orchestral</option>
                        <option value="hip-hop">Hip-Hop / Trap</option>
                        <option value="electronic">Electronic / EDM</option>
                        <option value="lo-fi">Lo-Fi / Chill</option>
                        <option value="rock">Rock / Metal</option>
                        <option value="jazz">Jazz / Soul</option>
                        <option value="pop">Pop</option>
                        <option value="ambient">Ambient / Atmospheric</option>
                        <option value="game ost">Game OST</option>
                        <option value="r&b">R&B</option>
                      </select>
                    </div>
                    <div>
                      <label style={mkLabel(T)}>Mood</label>
                      <select value={musicMood} onChange={e => setMusicMood(e.target.value)} style={mkSelect(T)}>
                        <option value="epic">Epic</option>
                        <option value="emotional">Emotional</option>
                        <option value="energetic">Energetic</option>
                        <option value="dark">Dark / Tense</option>
                        <option value="uplifting">Uplifting</option>
                        <option value="melancholic">Melancholic</option>
                        <option value="mysterious">Mysterious</option>
                        <option value="chill">Chill / Relaxed</option>
                      </select>
                    </div>
                    <div>
                      <label style={mkLabel(T)}>BPM</label>
                      <input type="number" min={60} max={200} value={musicBpm} onChange={e => setMusicBpm(Number(e.target.value))} style={{ ...mkInput(T), width: '80px' }} />
                    </div>
                  </div>
                  <div>
                    <label style={mkLabel(T)}>Duration: {musicDuration}s {musicDuration >= 60 ? `(${(musicDuration/60).toFixed(1)}min)` : ''}</label>
                    <input type="range" min={5} max={60} step={5} value={musicDuration} onChange={e => setMusicDuration(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: T.textSubtle }}><span>5s</span><span>30s</span><span>60s</span></div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="submit" disabled={creatingMusicJob || !musicConcept.trim()} style={{ ...mkBtn(T, 'gradient', creatingMusicJob || !musicConcept.trim()), borderRadius: '999px', padding: '12px 24px' }}>
                      {creatingMusicJob ? '⏳ Starting…' : '🎧 Generate Real Audio'}
                    </button>
                    <button type="button" disabled={generatingMusic || !musicConcept.trim()} onClick={generateMusic} style={{ ...mkBtn(T, 'secondary', generatingMusic || !musicConcept.trim()), borderRadius: '999px', padding: '12px 20px' }}>
                      {generatingMusic ? '📝 Writing…' : '📝 Brief Only'}
                    </button>
                  </div>
                  {musicResult && (
                    <div style={sectionCard({ marginTop: '8px' })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ fontSize: '14px', color: T.text }}>🎼 Production Brief</strong>
                        <button onClick={() => { const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([musicResult], {type:'text/plain'})); el.download = 'music-brief.txt'; el.click(); }} style={{ ...mkBtn(T, 'secondary'), fontSize: '11px', padding: '5px 10px' }}>⬇ Download</button>
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '12px', lineHeight: 1.7, margin: 0, color: T.textMuted, maxHeight: '240px', overflowY: 'auto' }}>{musicResult}</pre>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* RIGHT: Project Gallery */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: T.text }}>
                  {musicSubTab === 'musicvideo' ? 'Trending MVs' : 'Audio Projects'}
                </h2>
                {musicSubTab === 'musicvideo' && mvJobs.length > 0 && (
                  <button onClick={() => setTab('video')} style={{ ...mkBtn(T, 'secondary'), fontSize: '12px', padding: '6px 14px' }}>View All →</button>
                )}
              </div>

              {musicSubTab === 'musicvideo' && (
                <>
                  {mvJobs.length === 0 ? (
                    <div style={{ display: 'grid', gap: '16px' }}>
                      <div style={{ ...sectionCard(), textAlign: 'center', padding: '48px 32px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
                        <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: T.text }}>No Music Videos Yet</h3>
                        <p style={{ color: T.textMuted, margin: '0 0 20px', fontSize: '14px' }}>Fill out the form to generate your first AI music video.</p>
                      </div>
                      {/* Example/demo cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: '14px', opacity: 0.5 }}>
                        {['Beat Drop', 'Pop Spark', 'Goal Rush', 'Resilience'].map(title => (
                          <div key={title} style={{ ...sectionCard({ padding: '0', overflow: 'hidden' }) }}>
                            <div style={{ height: '120px', background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>🎵</div>
                            <div style={{ padding: '12px' }}>
                              <strong style={{ fontSize: '13px', color: T.text }}>{title}</strong>
                              <p style={{ margin: '3px 0 0', fontSize: '11px', color: T.textSubtle }}>TrezzWorld AI</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '16px' }}>
                      {mvJobs.map(job => (
                        <div key={job.jobId} style={{ ...sectionCard({ padding: '0', overflow: 'hidden' }) }}>
                          <div style={{ height: '140px', background: T.accentGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <span style={{ fontSize: '40px' }}>🎬</span>
                            <div style={{ position: 'absolute', top: '8px', right: '8px' }}><span style={pill(job.status, T)}>{job.status}</span></div>
                          </div>
                          <div style={{ padding: '14px' }}>
                            <strong style={{ fontSize: '13px', color: T.text, display: 'block', marginBottom: '4px' }}>{(job.storyboard?.title ?? job.concept).slice(0, 40)}{job.concept.length > 40 ? '…' : ''}</strong>
                            <p style={{ margin: '0 0 8px', fontSize: '11px', color: T.textSubtle }}>{fmtDur(job.durationSeconds)} · {job.style}</p>
                            <ProgressBar pct={job.progress} status={job.status} T={T} />
                            {job.downloadReady && (
                              <button onClick={() => { const a = document.createElement('a'); a.href = `${API}/api/video/${job.jobId}/download`; a.download = `mv-${job.jobId.slice(0,8)}.mp4`; a.click(); }} style={{ ...mkBtn(T, 'gradient'), fontSize: '11px', padding: '6px 12px', marginTop: '8px', width: '100%', borderRadius: '8px' }}>⬇ Download MP4</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {musicSubTab === 'audio' && (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {musicJobs.length === 0 ? (
                    <div style={{ ...sectionCard(), textAlign: 'center', padding: '48px 32px' }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎧</div>
                      <p style={{ color: T.textMuted, margin: 0 }}>No audio projects yet. Enter a concept and click Generate.</p>
                    </div>
                  ) : musicJobs.map(job => (
                    <div key={job.jobId} style={sectionCard({ padding: '16px' })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: T.text }}>{job.concept.slice(0, 60)}{job.concept.length > 60 ? '…' : ''}</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.textSubtle }}>{job.genre} · {job.bpm}bpm · {job.mood} · {job.durationSeconds}s{job.outputFormat ? ` · ${job.outputFormat.toUpperCase()}` : ''}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={pill(job.status, T)}>{job.status}</span>
                          {job.downloadReady && (
                            <button onClick={() => { const a = document.createElement('a'); a.href = `${API}/api/music/${job.jobId}/download`; a.download = `audio-${job.jobId.slice(0,8)}.${job.outputFormat ?? 'wav'}`; a.click(); }} style={{ ...mkBtn(T, 'gradient'), padding: '6px 14px', fontSize: '12px' }}>⬇ Download</button>
                          )}
                        </div>
                      </div>
                      <ProgressBar pct={job.progress} status={job.status} T={T} />
                      <p style={{ ...mkHint(T), marginTop: '5px' }}>{job.message}</p>
                      {job.error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.red }}>⚠️ {job.error}</p>}
                      {job.downloadReady && job.outputFormat !== 'txt' && (
                        <audio controls style={{ width: '100%', marginTop: '10px', height: '36px' }} src={`${API}/api/music/${job.jobId}/download`}>Your browser does not support audio.</audio>
                      )}
                      {job.compositionBrief && (
                        <details style={{ marginTop: '10px' }}>
                          <summary style={{ fontSize: '12px', color: T.textSubtle, cursor: 'pointer' }}>📄 View Production Brief</summary>
                          <pre style={{ fontSize: '11px', color: T.textMuted, marginTop: '8px', overflowY: 'auto', maxHeight: '180px', background: isDark ? '#06101e' : '#f3f0ff', padding: '10px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>{job.compositionBrief}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VIDEO EDITOR (Descript-inspired) ──────────────────────── */}
        {tab === 'video' && (
          <div style={pageWrap}>

            {/* Hero — "What can I help you with?" */}
            <section style={{ ...sectionCard(), background: isDark ? 'linear-gradient(135deg,#0f0e2a 0%,#1a1060 100%)' : 'linear-gradient(135deg,#f0edff 0%,#e8e2ff 100%)', border: `1px solid ${T.borderAccent}`, padding: '36px' }}>
              <div style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎬</div>
                <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: 800, color: T.text }}>What can I help you with?</h1>
                <p style={{ margin: '0 0 24px', color: T.textMuted, fontSize: '14px' }}>Upload a file or describe what you want to make, and AI will help you plan it.</p>

                <form onSubmit={startQuickVideo} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '0', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)', border: `1px solid ${T.borderAccent}`, borderRadius: '14px', overflow: 'hidden', alignItems: 'center', padding: '4px 4px 4px 16px' }}>
                    <span style={{ color: T.textSubtle, fontSize: '18px', marginRight: '8px' }}>📎</span>
                    <input value={videoQuickPrompt} onChange={e => setVideoQuickPrompt(e.target.value)} placeholder="Upload a file or describe what you want to make…" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: '14px', padding: '10px 0' }} />
                    <button type="submit" disabled={creatingVideo || (!videoQuickPrompt.trim() && !videoConcept.trim())} style={{ ...mkBtn(T, 'gradient', creatingVideo || (!videoQuickPrompt.trim() && !videoConcept.trim())), borderRadius: '10px', padding: '10px 20px', flexShrink: 0 }}>
                      {creatingVideo ? '⏳ Starting…' : 'Get started'}
                    </button>
                  </div>
                </form>

                {/* Quick action chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                  {[
                    { label: '🎵 Create music video', concept: 'Create a cinematic music video' },
                    { label: '🎭 Generate with avatar', concept: 'Generate a video with an AI avatar presenter' },
                    { label: '🎙 Rough cut from audio', concept: 'Create a rough cut from audio transcript' },
                    { label: '📱 Create social clips', concept: 'Create short social media clips' },
                    { label: '🌍 Translate & dub', concept: 'Translate and dub video into another language' },
                    { label: '🖼 Turn slides into video', concept: 'Convert presentation slides into a video' },
                    { label: '✨ Generate animated', concept: 'Generate an animated explainer video' },
                    { label: '🎨 Browse templates…', concept: '' },
                  ].map(chip => (
                    <button key={chip.label} onClick={() => { if (chip.concept) { setVideoQuickPrompt(chip.concept); setVideoConcept(chip.concept); } }} style={{ background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', color: T.textMuted, border: `1px solid ${T.border}`, borderRadius: '999px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Popular features */}
            <section>
              <h2 style={{ ...H2, marginBottom: '14px' }}>Popular features</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '16px' }}>
                {[
                  { icon: '🎥', title: 'AI video maker', desc: 'Watch AI make your video with voiceover and visuals', action: 'Make a video about…', tab: 'video' as Tab },
                  { icon: '🎵', title: 'Music Video Creator', desc: 'Generate a music video from your song and photos', action: 'Create music video →', tab: 'music' as Tab },
                  { icon: '🎙', title: 'Record & Edit', desc: 'Record, transcribe, and edit with text-based editing', action: 'Start recording', tab: 'video' as Tab },
                ].map(feat => (
                  <div key={feat.title} style={{ ...sectionCard(), cursor: 'pointer', display: 'flex', gap: '16px', alignItems: 'flex-start', transition: 'border-color 0.15s', borderColor: T.borderAccent }} onClick={() => setTab(feat.tab)}>
                    <div style={{ fontSize: '28px', flexShrink: 0 }}>{feat.icon}</div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '15px', color: T.text, display: 'block', marginBottom: '4px' }}>{feat.title}</strong>
                      <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.textMuted, lineHeight: 1.5 }}>{feat.desc}</p>
                      <span style={{ fontSize: '12px', color: T.accent, fontWeight: 600 }}>{feat.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Advanced creation form */}
            <section style={sectionCard()}>
              <h2 style={H2}>🎥 New Video Project</h2>
              <form onSubmit={startVideoCreation} style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={mkLabel(T)}>Concept / Script Prompt</label>
                  <textarea value={videoConcept} onChange={e => setVideoConcept(e.target.value)} rows={4} style={mkTextarea(T)} placeholder="Describe your video: 'A cinematic intro for TrezzWorld Adventures — showing the world map, key characters, epic battles, and ending with the logo reveal.'" />
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={mkLabel(T)}>Duration: {fmtDur(videoDuration)} {videoDuration > 60 ? `(${(videoDuration/60).toFixed(1)} min)` : ''}</label>
                    <input type="range" min={5} max={600} step={5} value={videoDuration} onChange={e => setVideoDuration(Number(e.target.value))} style={{ width: '100%', accentColor: T.accent }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: T.textSubtle }}><span>5s</span><span>5 min</span><span>10 min</span></div>
                  </div>
                  <div>
                    <label style={mkLabel(T)}>Style</label>
                    <select value={videoStyle} onChange={e => setVideoStyle(e.target.value)} style={mkSelect(T)}>
                      <option value="cinematic">Cinematic</option>
                      <option value="documentary">Documentary</option>
                      <option value="music video">Music Video</option>
                      <option value="game trailer">Game Trailer</option>
                      <option value="corporate">Corporate</option>
                      <option value="animated">Animated</option>
                      <option value="lo-fi aesthetic">Lo-fi Aesthetic</option>
                      <option value="epic fantasy">Epic Fantasy</option>
                    </select>
                  </div>
                  <div>
                    <label style={mkLabel(T)}>Resolution</label>
                    <select value={videoResolution} onChange={e => setVideoResolution(e.target.value)} style={mkSelect(T)}>
                      <option value="1080p">1080p (1920×1080)</option>
                      <option value="720p">720p (1280×720)</option>
                      <option value="4k">4K (3840×2160)</option>
                      <option value="vertical">Vertical (1080×1920)</option>
                      <option value="square">Square (1080×1080)</option>
                    </select>
                  </div>
                  <div>
                    <label style={mkLabel(T)}>FPS</label>
                    <select value={videoFps} onChange={e => setVideoFps(Number(e.target.value))} style={mkSelect(T)}>
                      <option value={24}>24 fps (cinematic)</option>
                      <option value={30}>30 fps (standard)</option>
                      <option value={60}>60 fps (smooth)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={creatingVideo || !videoConcept.trim()} style={{ ...mkBtn(T, 'gradient', creatingVideo || !videoConcept.trim()), padding: '13px 28px', fontSize: '15px', borderRadius: '12px', alignSelf: 'start' }}>
                  {creatingVideo ? '⏳ Starting…' : '🎬 Create Video'}
                </button>
              </form>
            </section>

            {/* Video projects */}
            {videoJobs.length > 0 && (
              <section style={sectionCard()}>
                <h2 style={H2}>Recent Projects</h2>
                <div style={{ display: 'grid', gap: '14px' }}>
                  {videoJobs.map(job => (
                    <div key={job.jobId} style={{ ...listRow, padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ fontSize: '14px', color: T.text }}>{job.concept.slice(0, 80)}{job.concept.length > 80 ? '…' : ''}</strong>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: T.textSubtle }}>{fmtDur(job.durationSeconds)} · {job.style} · {job.resolution} · {job.fps}fps · ID: {job.jobId.slice(0,8)}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={pill(job.status, T)}>{job.status}</span>
                          {job.downloadReady && (
                            <button onClick={() => { const a = document.createElement('a'); a.href = `${API}/api/video/${job.jobId}/download`; a.download = `trezzworld-video-${job.jobId.slice(0,8)}.mp4`; a.click(); }} style={{ ...mkBtn(T, 'gradient'), padding: '6px 14px', fontSize: '12px' }}>⬇ Download MP4</button>
                          )}
                        </div>
                      </div>
                      <ProgressBar pct={job.progress} status={job.status} T={T} />
                      <p style={{ ...mkHint(T), marginTop: '5px' }}>{job.message || job.status}</p>
                      {job.error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.red }}>⚠️ {job.error}</p>}
                      {job.storyboard?.scenes && job.storyboard.scenes.length > 0 && (
                        <details style={{ marginTop: '10px' }}>
                          <summary style={{ fontSize: '12px', color: T.textSubtle, cursor: 'pointer' }}>View storyboard ({job.storyboard.scenes.length} scenes)</summary>
                          <pre style={{ fontSize: '11px', color: T.textMuted, marginTop: '8px', overflowY: 'auto', maxHeight: '200px', background: isDark ? '#06101e' : '#f3f0ff', padding: '10px', borderRadius: '8px' }}>{JSON.stringify(job.storyboard, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── IMAGE GENERATOR ───────────────────────────────────────── */}
        {tab === 'image' && (
          <div style={pageWrap}>
            <section style={heroCard}>
              <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: T.text }}>🖼 Image Generator</h1>
              <p style={{ margin: 0, color: T.textMuted, fontSize: '14px' }}>Generate photographic images via AI, and engineer prompts for Midjourney, DALL-E, Firefly.</p>
            </section>

            {/* Render real image */}
            <section style={sectionCard()}>
              <h2 style={H2}>📸 Render Real Image</h2>
              <form onSubmit={renderRealImage} style={{ display: 'grid', gap: '14px' }}>
                <div>
                  <label style={mkLabel(T)}>Image Prompt</label>
                  <textarea value={imageRenderPrompt} onChange={e => setImageRenderPrompt(e.target.value)} rows={3} style={mkTextarea(T)} placeholder="e.g. TrezzWorld Adventures hero character standing on a cliff at golden hour, cinematic lighting, 8K detail, photorealistic" />
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={mkLabel(T)}>Style</label>
                    <select value={imageStyle} onChange={e => setImageStyle(e.target.value)} style={mkSelect(T)}>
                      <option value="photorealistic">Photorealistic</option>
                      <option value="cinematic">Cinematic Film Still</option>
                      <option value="digital art">Digital Art / Concept Art</option>
                      <option value="anime">Anime / Manga</option>
                      <option value="3d render">3D Render / CGI</option>
                      <option value="oil painting">Oil Painting</option>
                      <option value="watercolor">Watercolor</option>
                      <option value="comic book">Comic Book</option>
                      <option value="pixel art">Pixel Art</option>
                    </select>
                  </div>
                  <button type="submit" disabled={renderingImage || !imageRenderPrompt.trim()} style={{ ...mkBtn(T, 'gradient', renderingImage || !imageRenderPrompt.trim()), padding: '12px 22px', fontSize: '14px', borderRadius: '10px' }}>
                    {renderingImage ? '🖼 Generating…' : '📸 Render Image'}
                  </button>
                </div>
              </form>
              {imageRenderResult && (
                <div style={{ marginTop: '16px' }}>
                  {imageRenderResult.ok && imageRenderResult.imageBase64 ? (
                    <div>
                      <p style={{ ...mkHint(T), marginBottom: '10px' }}>✅ {imageRenderResult.message}</p>
                      <img src={`data:image/${imageRenderResult.format ?? 'png'};base64,${imageRenderResult.imageBase64}`} alt="AI generated" style={{ width: '100%', maxWidth: '800px', borderRadius: '12px', border: `1px solid ${T.borderAccent}` }} />
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => { const a = document.createElement('a'); a.href = `data:image/${imageRenderResult.format};base64,${imageRenderResult.imageBase64}`; a.download = `trezzworld-render.${imageRenderResult.format}`; a.click(); }} style={{ ...mkBtn(T, 'secondary'), fontSize: '12px', padding: '6px 14px' }}>⬇ Download</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...sectionCard(), background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', border: `1px solid rgba(239,68,68,0.2)`, marginTop: '12px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: T.red }}>{imageRenderResult.message}</p>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: T.textMuted }}>Use the Prompt Engineer below for Midjourney, DALL-E 3, or Adobe Firefly.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Prompt engineer */}
            <section style={sectionCard()}>
              <h2 style={H2}>🎨 Prompt Engineer (Midjourney / DALL-E / Firefly)</h2>
              <form onSubmit={generateImage} style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={mkLabel(T)}>Concept</label>
                  <textarea value={imageConcept} onChange={e => setImageConcept(e.target.value)} rows={3} style={mkTextarea(T)} placeholder="e.g. TrezzWorld Adventures game poster — epic fantasy landscape with characters, golden hour lighting, dramatic sky" />
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  <div>
                    <label style={mkLabel(T)}>Aspect Ratio</label>
                    <select value={imageAspect} onChange={e => setImageAspect(e.target.value)} style={mkSelect(T)}>
                      <option value="16:9">16:9 — Landscape</option>
                      <option value="1:1">1:1 — Square</option>
                      <option value="9:16">9:16 — Vertical</option>
                      <option value="4:3">4:3 — Standard</option>
                      <option value="3:2">3:2 — Photo</option>
                      <option value="21:9">21:9 — Ultrawide</option>
                    </select>
                  </div>
                  <div>
                    <label style={mkLabel(T)}>Variations</label>
                    <select value={imageCount} onChange={e => setImageCount(Number(e.target.value))} style={mkSelect(T)}>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={4}>4</option>
                      <option value={6}>6</option>
                      <option value={8}>8</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={generatingImage || !imageConcept.trim()} style={{ ...mkBtn(T, 'secondary', generatingImage || !imageConcept.trim()), padding: '12px 24px', fontSize: '14px', borderRadius: '10px', alignSelf: 'start' }}>
                  {generatingImage ? '🖼 Engineering prompts…' : '🖼 Generate Image Prompts'}
                </button>
              </form>
              {imageResult && (
                <div style={{ marginTop: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '14px', color: T.text }}>🎨 Generated Prompts</strong>
                    <button onClick={() => { const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([imageResult], {type:'text/plain'})); el.download = 'image-prompts.txt'; el.click(); }} style={{ ...mkBtn(T, 'secondary'), fontSize: '11px', padding: '5px 10px' }}>⬇ Download</button>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: '"Inter", system-ui, sans-serif', fontSize: '13px', lineHeight: 1.7, margin: 0, color: T.textMuted, maxHeight: '500px', overflowY: 'auto', background: isDark ? '#06101e' : '#f8f6ff', padding: '16px', borderRadius: '10px' }}>{imageResult}</pre>
                  <p style={{ ...mkHint(T), marginTop: '10px' }}>Copy each prompt into Stable Diffusion, Midjourney, DALL-E 3, Adobe Firefly, or use the Render button above.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── LUMI CHAT ─────────────────────────────────────────────── */}
        {tab === 'chat' && (
          <div style={pageWrap}>
            <section style={heroCard}>
              <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: T.text }}>💬 Chat with LUMI</h1>
              <p style={{ margin: 0, color: T.textMuted, fontSize: '14px' }}>LUMI — Layered Universal Media Intelligence. Your autonomous AI production brain.</p>
            </section>

            {/* Model settings */}
            <section style={sectionCard()}>
              <h2 style={H2}>Model Settings</h2>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={mkLabel(T)}>AI Provider</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setUseOllama(false)} style={{ ...mkBtn(T, useOllama ? 'secondary' : 'gradient'), fontSize: '13px', borderRadius: '8px' }}>☁️ Cloud</button>
                    <button onClick={() => setUseOllama(true)} style={{ ...mkBtn(T, !useOllama ? 'secondary' : 'gradient'), fontSize: '13px', borderRadius: '8px' }}>🖥️ Local{isOllamaUp ? '' : ' (offline)'}</button>
                  </div>
                </div>
                {useOllama && (
                  <div>
                    <label style={mkLabel(T)}>Local Model</label>
                    <select value={selectedOllamaModel} onChange={e => setSelectedOllamaModel(e.target.value)} style={mkSelect(T)}>
                      <option value="gemma3:27b">SuperGemma 26B ⭐</option>
                      <option value="gemma3:12b">Gemma 3 12B</option>
                      <option value="gemma3:4b">Gemma 3 4B</option>
                      <option value="llama3.1:8b">Llama 3.1 8B</option>
                      <option value="llama3.1:70b">Llama 3.1 70B</option>
                      <option value="mistral:7b">Mistral 7B</option>
                      <option value="qwen2.5:7b">Qwen 2.5 7B</option>
                      <option value="deepseek-r1:7b">DeepSeek R1 7B</option>
                      {availableOllamaModels.map(m => <option key={m.id} value={m.id}>{m.label} ✓</option>)}
                    </select>
                    {!isOllamaUp && <p style={{ ...mkHint(T), color: T.yellow }}>⚠️ Local AI offline. Run: <code>ollama serve</code></p>}
                  </div>
                )}
                <div>
                  <label style={mkLabel(T)}>Creative Domain</label>
                  <select value={chatDomain} onChange={e => setChatDomain(e.target.value)} style={mkSelect(T)}>
                    <option value="default">🤖 LUMI General</option>
                    <option value="video">🎥 Video Production</option>
                    <option value="music">🎵 Music Composition</option>
                    <option value="game">🎮 Game Design</option>
                    <option value="code">💻 Code Generation</option>
                    <option value="creative">✨ Creative Direction</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Chat window */}
            <section style={sectionCard()}>
              <div style={{ minHeight: '340px', maxHeight: '500px', overflowY: 'auto', background: isDark ? '#060e1c' : '#faf9ff', borderRadius: '12px', padding: '16px', marginBottom: '14px', display: 'grid', gap: '12px', alignContent: 'start', border: `1px solid ${T.border}` }}>
                {chatHistory.length === 0 && <p style={{ color: T.textSubtle, margin: 0, fontSize: '13px' }}>Ask LUMI to plan, build, generate video storyboards, compose music, design games, or write code…</p>}
                {chatHistory.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: msg.role === 'user' ? T.accentGrad : (isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'), color: msg.role === 'user' ? '#fff' : T.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '14px' }}>
                      {msg.content}
                    </div>
                    {msg.model && <p style={{ margin: '3px 6px 0', fontSize: '10px', color: T.textSubtle }}>{msg.model}</p>}
                  </div>
                ))}
                {loadingChat && <div style={{ color: T.textSubtle, fontSize: '13px', fontStyle: 'italic' }}>LUMI is thinking…</div>}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} style={{ display: 'flex', gap: '10px' }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask LUMI anything — video scripts, game design, code, music, production pipelines…" disabled={loadingChat} style={{ ...mkInput(T), flex: 1, borderRadius: '999px', padding: '12px 18px' }} />
                <button type="submit" disabled={loadingChat || !chatInput.trim()} style={{ ...mkBtn(T, 'gradient', loadingChat || !chatInput.trim()), borderRadius: '999px', padding: '12px 22px' }}>Send</button>
              </form>
              {chatHistory.length > 0 && (
                <button onClick={() => setChatHistory([])} style={{ ...mkBtn(T, 'secondary'), fontSize: '12px', marginTop: '8px', borderRadius: '8px' }}>Clear chat</button>
              )}
            </section>
          </div>
        )}

        {/* ── CODE GENERATOR ────────────────────────────────────────── */}
        {tab === 'code' && (
          <div style={pageWrap}>
            <section style={heroCard}>
              <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: T.text }}>💻 Code & Docs Workspace</h1>
              <p style={{ margin: 0, color: T.textMuted, fontSize: '14px' }}>Generate production-ready code, documentation, APIs, games, scripts, and builds. All languages. No placeholders.</p>
            </section>

            <section style={sectionCard()}>
              <h2 style={H2}>Code Generator</h2>
              <form onSubmit={generateCode} style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={mkLabel(T)}>What to build</label>
                  <textarea value={codePrompt} onChange={e => setCodePrompt(e.target.value)} rows={4} style={mkTextarea(T)} placeholder="e.g. A React component for a video upload panel with drag-and-drop, progress bar, file validation (mp4/mov only, 500MB max), and a cancel button." />
                </div>
                <div>
                  <label style={mkLabel(T)}>Language / Framework</label>
                  <select value={codeLanguage} onChange={e => setCodeLanguage(e.target.value)} style={mkSelect(T)}>
                    <option value="typescript">TypeScript / React</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript / Node.js</option>
                    <option value="lua">Lua (Roblox)</option>
                    <option value="csharp">C# (Unity)</option>
                    <option value="gdscript">GDScript (Godot)</option>
                    <option value="html/css">HTML / CSS</option>
                    <option value="sql">SQL</option>
                    <option value="bash">Bash / PowerShell</option>
                    <option value="rust">Rust</option>
                    <option value="go">Go</option>
                    <option value="swift">Swift / SwiftUI</option>
                    <option value="kotlin">Kotlin (Android)</option>
                    <option value="markdown">Markdown Documentation</option>
                  </select>
                </div>
                <button type="submit" disabled={generatingCode || !codePrompt.trim()} style={{ ...mkBtn(T, 'gradient', generatingCode || !codePrompt.trim()), padding: '13px 28px', fontSize: '15px', borderRadius: '12px', alignSelf: 'start' }}>
                  {generatingCode ? '💻 Generating…' : '💻 Generate Code'}
                </button>
              </form>
            </section>

            {codeResult && (
              <section style={sectionCard()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h2 style={{ ...H2, margin: 0 }}>📄 Output</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => navigator.clipboard.writeText(codeResult)} style={{ ...mkBtn(T, 'secondary'), fontSize: '12px', padding: '6px 12px' }}>📋 Copy</button>
                    <button onClick={() => { const el = document.createElement('a'); const ext = codeLanguage === 'python' ? 'py' : codeLanguage === 'lua' ? 'lua' : codeLanguage === 'html/css' ? 'html' : 'ts'; el.href = URL.createObjectURL(new Blob([codeResult], {type:'text/plain'})); el.download = `lumi-output.${ext}`; el.click(); }} style={{ ...mkBtn(T, 'secondary'), fontSize: '12px', padding: '6px 12px' }}>⬇ Download</button>
                  </div>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: '"Fira Code", "Cascadia Code", monospace', fontSize: '13px', lineHeight: 1.6, margin: 0, background: isDark ? '#06101e' : '#f8f6ff', padding: '16px', borderRadius: '10px', overflowX: 'auto', maxHeight: '640px', overflowY: 'auto', color: T.text, border: `1px solid ${T.border}` }}>{codeResult}</pre>
              </section>
            )}
          </div>
        )}

        {/* ── SETTINGS ──────────────────────────────────────────────── */}
        {tab === 'settings' && (
          <div style={pageWrap}>
            <section style={heroCard}>
              <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 800, color: T.text }}>⚙️ Settings</h1>
              <p style={{ margin: 0, color: T.textMuted, fontSize: '14px' }}>Add your own AI API keys to unlock additional capabilities. All keys are stored securely and never exposed to the browser.</p>
            </section>

            {/* Your API Keys */}
            <section style={sectionCard()}>
              <h2 style={H2}>🔑 Your API Keys</h2>
              <p style={{ ...mkHint(T), marginBottom: '18px', fontSize: '13px', color: T.textMuted }}>
                Add your own API key from any supported provider to enable or enhance AI features. The studio works without keys using free tiers, but adding a key unlocks higher quality and more capacity.
              </p>

              {userKeys && userKeys.configured_count > 0 && (
                <div style={{ marginBottom: '20px', display: 'grid', gap: '10px' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '13px', color: T.textMuted, fontWeight: 600 }}>Configured Keys ({userKeys.configured_count})</h3>
                  {userKeys.providers.filter(p => p.configured).map(p => (
                    <div key={p.provider} style={{ ...listRow, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '14px', color: T.text }}>{p.name}</strong>
                        <span style={{ marginLeft: '12px', fontSize: '12px', color: T.textSubtle, fontFamily: 'monospace' }}>{p.key_preview}</span>
                        {p.added_at && <p style={{ margin: '2px 0 0', fontSize: '11px', color: T.textSubtle }}>Added {new Date(p.added_at).toLocaleDateString()}</p>}
                      </div>
                      <button onClick={() => removeUserKey(p.provider)} style={{ ...mkBtn(T, 'danger'), fontSize: '12px', padding: '5px 12px' }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={saveUserKey} style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={mkLabel(T)}>Provider</label>
                    <select value={addKeyProvider} onChange={e => setAddKeyProvider(e.target.value)} style={mkSelect(T)}>
                      <option value="openrouter">OpenRouter (recommended)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google AI</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={mkLabel(T)}>API Key</label>
                    <input type="password" value={addKeyValue} onChange={e => setAddKeyValue(e.target.value)} placeholder="Paste your API key here…" style={mkInput(T)} />
                  </div>
                  <div style={{ minWidth: '160px' }}>
                    <label style={mkLabel(T)}>Label (optional)</label>
                    <input value={addKeyLabel} onChange={e => setAddKeyLabel(e.target.value)} placeholder="My key" style={mkInput(T)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="submit" disabled={addKeyLoading || !addKeyValue.trim()} style={{ ...mkBtn(T, 'gradient', addKeyLoading || !addKeyValue.trim()), borderRadius: '10px', padding: '11px 22px' }}>
                    {addKeyLoading ? 'Saving…' : '💾 Save Key'}
                  </button>
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: T.accent, textDecoration: 'none', fontWeight: 600 }}>Get a free OpenRouter key →</a>
                </div>
                {addKeyMsg && <p style={{ margin: 0, fontSize: '13px', color: addKeyMsg.startsWith('⚠️') ? T.red : T.green }}>{addKeyMsg}</p>}
              </form>
            </section>

            {/* Available providers directory */}
            <section style={sectionCard()}>
              <h2 style={H2}>🌐 Supported AI Providers</h2>
              <div style={autoGrid}>
                {[
                  { name: 'OpenRouter', desc: 'Access 100+ AI models with one key. Recommended.', url: 'https://openrouter.ai/keys', free: true },
                  { name: 'OpenAI', desc: 'GPT-4o, DALL-E 3, and Whisper for audio transcription.', url: 'https://platform.openai.com/api-keys', free: false },
                  { name: 'Anthropic', desc: 'Claude Opus, Sonnet — best for long-form creative writing.', url: 'https://console.anthropic.com/', free: false },
                  { name: 'Google AI', desc: 'Gemini Pro for multimodal generation.', url: 'https://aistudio.google.com/app/apikey', free: true },
                  { name: 'HuggingFace', desc: 'MusicGen, FLUX, SDXL for music & image generation.', url: 'https://huggingface.co/settings/tokens', free: true },
                  { name: 'Replicate', desc: 'Run thousands of open-source models in the cloud.', url: 'https://replicate.com/account/api-tokens', free: false },
                ].map(p => (
                  <div key={p.name} style={listRow}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '14px', color: T.text }}>{p.name}</strong>
                      {p.free && <span style={{ ...pill('active', T), fontSize: '10px' }}>Free tier</span>}
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: T.textMuted }}>{p.desc}</p>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: T.accent, textDecoration: 'none', fontWeight: 600 }}>Get API key →</a>
                  </div>
                ))}
              </div>
            </section>

            {/* Local AI setup */}
            <section style={sectionCard()}>
              <h2 style={H2}>🖥️ Local AI (Ollama)</h2>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div style={{ ...listRow, flex: 1, minWidth: '160px', background: isOllamaUp ? (isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)') : (isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)'), border: `1px solid ${isOllamaUp ? T.green : T.red}30` }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.textMuted }}>Status</p>
                  <strong style={{ color: isOllamaUp ? T.green : T.red }}>{isOllamaUp ? '✅ Running' : '⚠️ Offline'}</strong>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: T.textSubtle }}>{ollamaStatus?.host ?? 'http://localhost:11434'}</p>
                </div>
                <div style={{ ...listRow, flex: 1, minWidth: '160px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: T.textMuted }}>Models Installed</p>
                  <strong style={{ fontSize: '22px', color: T.text }}>{ollamaStatus?.localModels.length ?? 0}</strong>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: T.textSubtle }}>{(ollamaStatus?.localModels ?? []).map(m => m.name).join(', ') || 'none pulled'}</p>
                </div>
              </div>
              {!isOllamaUp && (
                <div style={{ ...listRow, background: isDark ? 'rgba(250,204,21,0.07)' : 'rgba(250,204,21,0.08)', border: `1px solid rgba(250,204,21,0.25)`, padding: '14px 16px', marginBottom: '12px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: T.text }}>
                    <strong style={{ color: T.yellow }}>Quick Setup:</strong><br />
                    <code style={{ color: T.textMuted }}>1. Download Ollama → 2. ollama serve → 3. ollama pull gemma3:27b</code>
                  </p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <a href="https://ollama.com/download" target="_blank" rel="noreferrer" style={{ ...mkBtn(T, 'secondary'), fontSize: '12px', padding: '7px 14px', textDecoration: 'none', display: 'inline-block', borderRadius: '8px' }}>⬇ Download Ollama</a>
                    <a href="https://github.com/Trezzhaused/trezzworld-production-studio#readme" target="_blank" rel="noreferrer" style={{ ...mkBtn(T, 'secondary'), fontSize: '12px', padding: '7px 14px', textDecoration: 'none', display: 'inline-block', borderRadius: '8px' }}>📖 Setup Guide</a>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

      </main>
    </div>
  );
}
