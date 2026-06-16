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
interface ModelCascadeEntry { id: string; tier: string; priority: number; }
interface VideoStoryboardScene { id: string; title: string; duration_seconds: number; visual_description: string; text_overlay?: string; transition_in: string; transition_out: string; camera_motion: string; color_grade: string; }
interface VideoStoryboard { title?: string; logline?: string; style?: string; total_duration_seconds?: number; color_palette?: string[]; audio?: Record<string, unknown>; scenes?: VideoStoryboardScene[]; }
interface VideoJob { jobId: string; concept: string; durationSeconds: number; style: string; resolution: string; fps: number; status: string; progress: number; message: string; storyboard: VideoStoryboard; outputPath: string | null; downloadReady: boolean; error: string | null; createdAt: number; }

type Tab = 'studio' | 'chat' | 'video' | 'models';

const API = 'http://localhost:8000';

// ─── Styles ───────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = { minHeight: '100vh', background: '#060e1c', color: '#e2e8f5', fontFamily: '"Inter", system-ui, sans-serif', padding: '0' };
const topBar: React.CSSProperties = { background: 'linear-gradient(90deg, #0b1e3d 0%, #0a3060 50%, #0b1e3d 100%)', borderBottom: '1px solid rgba(56,189,248,0.15)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', position: 'sticky', top: 0, zIndex: 100 };
const tabBar: React.CSSProperties = { display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px' };
const pageWrap: React.CSSProperties = { maxWidth: '1400px', margin: '0 auto', padding: '24px 28px', display: 'grid', gap: '18px' };
const card: React.CSSProperties = { background: '#0c1829', borderRadius: '16px', padding: '20px', border: '1px solid rgba(148,163,184,0.14)', boxShadow: '0 8px 28px rgba(0,0,0,0.3)' };
const heroCard: React.CSSProperties = { ...card, background: 'linear-gradient(135deg, #0d2040 0%, #0b4a78 100%)', border: '1px solid rgba(56,189,248,0.2)' };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' };
const row: React.CSSProperties = { display: 'flex', gap: '10px', alignItems: 'center' };
const listBase: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' };
const listItem: React.CSSProperties = { padding: '12px 14px', background: 'rgba(10,20,40,0.6)', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.1)' };

const pill = (status: string): React.CSSProperties => ({
  display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
  background: ['active','ready','running','done'].includes(status) ? 'rgba(34,197,94,0.2)' : ['in-progress','standby','warn','scheduled'].includes(status) ? 'rgba(250,204,21,0.18)' : ['error','failed'].includes(status) ? 'rgba(239,68,68,0.2)' : 'rgba(148,163,184,0.15)',
  color: ['active','ready','running','done'].includes(status) ? '#86efac' : ['in-progress','standby','warn','scheduled'].includes(status) ? '#fde68a' : ['error','failed'].includes(status) ? '#fca5a5' : '#cbd5e1',
});

const btn = (variant: 'primary'|'secondary'|'danger' = 'primary', disabled = false): React.CSSProperties => ({
  background: disabled ? '#1a2d4a' : variant === 'primary' ? '#38bdf8' : variant === 'danger' ? '#ef4444' : 'rgba(56,189,248,0.12)',
  color: disabled ? '#4a607a' : variant === 'primary' ? '#031426' : '#e2e8f5',
  border: variant === 'secondary' ? '1px solid rgba(56,189,248,0.3)' : '0',
  borderRadius: '10px', padding: '10px 18px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '14px',
});

const input: React.CSSProperties = { background: '#07101e', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '10px', color: '#e2e8f5', padding: '10px 14px', fontSize: '14px', width: '100%' };
const textarea: React.CSSProperties = { ...input, resize: 'vertical' };
const select: React.CSSProperties = { ...input, width: 'auto', minWidth: '140px' };
const label: React.CSSProperties = { fontSize: '12px', fontWeight: 600, opacity: 0.7, marginBottom: '4px', display: 'block' };
const hint: React.CSSProperties = { fontSize: '12px', opacity: 0.55, margin: '4px 0 0' };
const h2style: React.CSSProperties = { marginTop: 0, marginBottom: '14px', fontSize: '16px', fontWeight: 700 };
const progress = (pct: number, col = '#38bdf8'): React.CSSProperties => ({ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '999px', overflow: 'hidden', position: 'relative' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDur = (s: number) => s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? 'rgba(56,189,248,0.18)' : 'transparent', color: active ? '#38bdf8' : '#94a3b8', border: active ? '1px solid rgba(56,189,248,0.3)' : '1px solid transparent', borderRadius: '8px', padding: '7px 16px', fontWeight: active ? 700 : 500, cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s' }}>
      {label}
    </button>
  );
}

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const col = status === 'done' || status === 'completed' ? '#86efac' : status === 'error' || status === 'failed' ? '#fca5a5' : '#38bdf8';
  return (
    <div style={progress(pct)}>
      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: '999px', transition: 'width 0.5s ease' }} />
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: ok ? '#22c55e' : '#6b7280', marginRight: '6px' }} />;
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<Tab>('studio');

  // Backend data
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaDevelopmentStatus | null>(null);
  const [metaBuilderStatus, setMetaBuilderStatus] = useState<MetaBuilderStatus | null>(null);
  const [controlPlane, setControlPlane] = useState<ControlPlaneStatus | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [openRouterCascade, setOpenRouterCascade] = useState<ModelCascadeEntry[]>([]);

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

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.allSettled([
      fetchJson<BackendStatus>(`${API}/api/status`, ctrl.signal),
      fetchJson<MetaDevelopmentStatus>(`${API}/api/meta-development/status`, ctrl.signal),
      fetchJson<MetaBuilderStatus>(`${API}/api/meta-builder/status`, ctrl.signal),
      fetchJson<ControlPlaneStatus>(`${API}/api/studio/control-plane`, ctrl.signal),
      fetchJson<{ available: boolean; host: string; localModels: Array<{name:string}>; catalogue: OllamaModel[]; superGemmaReady: boolean; installHint: string }>(`${API}/api/ollama/status`, ctrl.signal),
      fetchJson<{ cascade: ModelCascadeEntry[] }>(`${API}/api/lumi/models`, ctrl.signal),
    ]).then(([bk, meta, mb, cp, ol, models]) => {
      if (bk.status === 'fulfilled') setBackendStatus(bk.value);
      if (meta.status === 'fulfilled') setMetaStatus(meta.value);
      if (mb.status === 'fulfilled') setMetaBuilderStatus(mb.value);
      if (cp.status === 'fulfilled') setControlPlane(cp.value);
      if (ol.status === 'fulfilled') setOllamaStatus(ol.value);
      if (models.status === 'fulfilled') setOpenRouterCascade(models.value.cascade ?? []);
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
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setLoadingChat(true);
    try {
      const data = await postJson<{ content: string; model: string; ok: boolean }>(`${API}/api/lumi/chat`, {
        message: userMsg.content,
        missionId: activeMissionId,
        history: chatHistory.slice(-20).map(m => ({ role: m.role, content: m.content })),
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

  const downloadVideo = (jobId: string) => {
    const a = document.createElement('a');
    a.href = `${API}/api/video/${jobId}/download`;
    a.download = `trezzworld-video-${jobId.slice(0,8)}.mp4`;
    a.click();
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const activeQueue = pipelineStatus?.jobs ?? missionBoot?.executionQueue ?? controlPlane?.executionQueue ?? [];
  const readiness = controlPlane?.productionReadiness.score ?? metaStatus?.productionReadiness.score ?? 0;
  const pipelinePct = pipelineStatus?.progress.percent ?? 0;
  const isBackendUp = !!backendStatus;
  const isOllamaUp = ollamaStatus?.available ?? false;
  const availableOllamaModels = ollamaStatus?.catalogue.filter(m => m.available) ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={shell}>
      {/* Top bar */}
      <header style={topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.5px', color: '#38bdf8' }}>TrezzWorld</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span style={{ fontSize: '13px', opacity: 0.7 }}>Production Studio</span>
        </div>
        <div style={tabBar}>
          <TabButton id="studio" label="🎬 Studio" active={tab==='studio'} onClick={() => setTab('studio')} />
          <TabButton id="chat" label="💬 LUMI Chat" active={tab==='chat'} onClick={() => setTab('chat')} />
          <TabButton id="video" label="🎥 Video Creator" active={tab==='video'} onClick={() => setTab('video')} />
          <TabButton id="models" label="🤖 AI Models" active={tab==='models'} onClick={() => setTab('models')} />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px' }}>
          <StatusDot ok={isBackendUp} /><span style={{ opacity: 0.7 }}>Backend</span>
          <StatusDot ok={isOllamaUp} /><span style={{ opacity: 0.7 }}>Ollama</span>
        </div>
      </header>

      {/* ── STUDIO TAB ─────────────────────────────────────────────────── */}
      {tab === 'studio' && (
        <div style={pageWrap}>
          {/* Hero */}
          <section style={heroCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 6px', fontSize: '12px', opacity: 0.65, textTransform: 'uppercase', letterSpacing: '1px' }}>LUMI Control Plane</p>
                <h1 style={{ margin: '0 0 10px', fontSize: '26px' }}>{controlPlane?.workspaceTitle ?? 'TrezzWorld Production Studio'}</h1>
                <p style={{ maxWidth: '800px', lineHeight: 1.65, opacity: 0.85, margin: 0 }}>{controlPlane?.finishLine ?? 'A single prompt produces an end-to-end deliverable with minimal human intervention.'}</p>
              </div>
              <div style={{ ...card, minWidth: '200px', background: 'rgba(7,17,35,0.6)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', opacity: 0.6 }}>Backend API</p>
                <strong style={{ color: isBackendUp ? '#86efac' : '#fca5a5' }}>{isBackendUp ? `✅ ${backendStatus!.status}` : '⚠️ offline'}</strong>
                <p style={{ margin: '4px 0 0', opacity: 0.6, fontSize: '12px' }}>v{backendStatus?.version ?? 'n/a'}</p>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section style={grid}>
            {[
              { label: 'Production Readiness', value: `${readiness}%`, sub: metaBuilderStatus?.summary ?? '…' },
              { label: 'Source Files', value: metaStatus?.repositoryIntelligence.sourceFiles ?? 0, sub: `TODO markers: ${metaStatus?.repositoryIntelligence.todoMarkers ?? 0}` },
              { label: 'MetaBuilder Autonomy', value: `${metaBuilderStatus?.readinessEstimate ?? 0}%`, sub: 'Goal: ready-to-start studio shell' },
              { label: 'Next ROI Move', value: '', sub: metaStatus?.highestRoiNextMove ?? 'Waiting for backend.' },
            ].map(s => (
              <div key={s.label} style={card}>
                <p style={{ margin: '0 0 4px', opacity: 0.7, fontSize: '12px' }}>{s.label}</p>
                {s.value !== '' && <h2 style={{ margin: '0 0 6px', fontSize: '22px' }}>{s.value}</h2>}
                <p style={{ margin: 0, opacity: 0.7, fontSize: '13px', lineHeight: 1.5 }}>{s.sub}</p>
              </div>
            ))}
          </section>

          {/* Mission launcher */}
          <section style={grid}>
            <div style={{ ...card, gridColumn: 'span 2' }}>
              <h2 style={h2style}>🚀 Mission Launcher</h2>
              <form onSubmit={bootMission} style={{ display: 'grid', gap: '12px' }}>
                <textarea value={missionPrompt} onChange={e => setMissionPrompt(e.target.value)} rows={5} style={textarea} placeholder={controlPlane?.missionPromptPlaceholder ?? 'Describe your mission…'} />
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, opacity: 0.75, fontSize: '13px' }}>
                      {missionBoot ? `🚀 Mission ${missionBoot.missionId ?? ''} is ${missionBoot.status} via ${missionBoot.plannerModel ?? 'cascade'}.` : 'LUMI will plan and execute real pipeline tasks and write files.'}
                    </p>
                    {pipelineStatus?.status === 'running' && <p style={{ margin: '4px 0 0', color: '#38bdf8', fontSize: '13px' }}>⚡ {pipelineStatus.progress.completed}/{pipelineStatus.progress.total} jobs ({pipelinePct}%)</p>}
                    {pipelineStatus?.status === 'completed' && <p style={{ margin: '4px 0 0', color: '#86efac', fontSize: '13px' }}>✅ {pipelineStatus.summary}</p>}
                  </div>
                  <button type="submit" disabled={loadingMission} style={btn('primary', loadingMission)}>{loadingMission ? 'Booting…' : 'Boot LUMI Mission'}</button>
                </div>
              </form>
              {pipelineStatus && <div style={{ marginTop: '14px' }}><ProgressBar pct={pipelinePct} status={pipelineStatus.status} /><p style={{ ...hint, marginTop: '6px' }}>{pipelineStatus.progress.completed} done · {pipelineStatus.progress.running} running · {pipelineStatus.progress.errored} errors</p></div>}
            </div>

            <div style={card}>
              <h2 style={h2style}>Delivery Surfaces</h2>
              <ul style={listBase}>{(controlPlane?.deliverySurfaces ?? []).map(s => (<li key={s.name} style={listItem}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{s.name}</strong><span style={pill(s.status)}>{s.status}</span></div></li>))}</ul>
            </div>
          </section>

          {/* Execution + modules */}
          <section style={grid}>
            <div style={card}>
              <h2 style={h2style}>Workspace Modules</h2>
              <ul style={listBase}>{(controlPlane?.workspaceModules ?? []).map(m => (<li key={m.id} style={listItem}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{m.name}</strong><span style={pill(m.status)}>{m.status}</span></div><p style={{ margin: '6px 0 0', opacity: 0.7, fontSize: '13px' }}>{m.description}</p></li>))}</ul>
            </div>
            <div style={card}>
              <h2 style={h2style}>Execution Queue</h2>
              <ul style={listBase}>{activeQueue.map(j => (<li key={j.jobId ?? j.actionId} style={listItem}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: '13px' }}>{j.name}</strong><span style={pill(j.status)}>{j.status}</span></div><p style={{ margin: '5px 0 0', opacity: 0.65, fontSize: '12px' }}>{j.workerId} · {j.stage}{j.score != null ? ` · score ${j.score.toFixed(2)}` : ''}</p>{j.error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#fca5a5' }}>{j.error}</p>}</li>))}</ul>
            </div>
            <div style={card}>
              <h2 style={h2style}>Readiness Checks</h2>
              <ul style={listBase}>{(metaStatus?.productionReadiness.checks ?? []).map(c => (<li key={c.category} style={listItem}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: '13px' }}>{c.category}</strong><span style={pill(c.passed ? 'ready' : 'planned')}>{c.passed ? '✓ passed' : 'pending'}</span></div><p style={{ margin: '4px 0 0', opacity: 0.65, fontSize: '12px' }}>{c.goal}</p></li>))}</ul>
            </div>
          </section>
        </div>
      )}

      {/* ── CHAT TAB ───────────────────────────────────────────────────── */}
      {tab === 'chat' && (
        <div style={pageWrap}>
          <section style={heroCard}>
            <h1 style={{ margin: '0 0 6px', fontSize: '22px' }}>💬 Chat with LUMI</h1>
            <p style={{ margin: 0, opacity: 0.8, fontSize: '14px' }}>LUMI — Layered Universal Media Intelligence. Autonomous AI brain of TrezzWorld Production Studio.</p>
          </section>

          {/* Model selector row */}
          <section style={card}>
            <h2 style={h2style}>Model Settings</h2>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={label}>AI Provider</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setUseOllama(false)} style={{ ...btn(useOllama ? 'secondary' : 'primary'), fontSize: '13px' }}>☁️ OpenRouter</button>
                  <button onClick={() => setUseOllama(true)} style={{ ...btn(!useOllama ? 'secondary' : 'primary'), fontSize: '13px' }}>{isOllamaUp ? '🖥️ Ollama (local)' : '🖥️ Ollama (offline)'}</button>
                </div>
              </div>
              {useOllama && (
                <div>
                  <label style={label}>Ollama Model</label>
                  <select value={selectedOllamaModel} onChange={e => setSelectedOllamaModel(e.target.value)} style={select}>
                    <option value="gemma3:27b">SuperGemma 26B (gemma3:27b) ⭐</option>
                    <option value="gemma3:12b">Gemma 3 12B</option>
                    <option value="gemma3:4b">Gemma 3 4B</option>
                    <option value="gemma2:27b">Gemma 2 27B</option>
                    <option value="llama3.1:8b">Llama 3.1 8B</option>
                    <option value="llama3.1:70b">Llama 3.1 70B</option>
                    <option value="mistral:7b">Mistral 7B</option>
                    <option value="qwen2.5:7b">Qwen 2.5 7B</option>
                    <option value="deepseek-r1:7b">DeepSeek R1 7B</option>
                    <option value="phi4:14b">Phi-4 14B</option>
                    {availableOllamaModels.map(m => <option key={m.id} value={m.id}>{m.label} ✓</option>)}
                  </select>
                  {!isOllamaUp && <p style={{ ...hint, color: '#fcd34d' }}>⚠️ Ollama offline — run: <code>ollama serve</code></p>}
                </div>
              )}
              <div>
                <label style={label}>Creative Domain</label>
                <select value={chatDomain} onChange={e => setChatDomain(e.target.value)} style={select}>
                  <option value="default">🤖 LUMI General</option>
                  <option value="video">🎥 Video Production</option>
                  <option value="music">🎵 Music Composition</option>
                  <option value="game">🎮 Game Design</option>
                  <option value="code">💻 Code Generation</option>
                  <option value="creative">✨ Creative Direction</option>
                </select>
              </div>
              {!useOllama && (
                <p style={hint}>Using OpenRouter free cascade: Gemini → DeepSeek → Llama → Mistral → Claude → GPT.<br/>Set <code>OPENROUTER_API_KEY</code> in backend to enable.</p>
              )}
            </div>
          </section>

          {/* Chat window */}
          <section style={card}>
            <div style={{ minHeight: '320px', maxHeight: '480px', overflowY: 'auto', background: '#07101e', borderRadius: '12px', padding: '16px', marginBottom: '12px', display: 'grid', gap: '10px', alignContent: 'start' }}>
              {chatHistory.length === 0 && <p style={{ opacity: 0.4, margin: 0 }}>Ask LUMI to plan, build, explain, generate video storyboards, compose music, design games, or write code…</p>}
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: '14px', background: msg.role === 'user' ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.1)', color: '#e2e8f5', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: '14px' }}>{msg.content}</div>
                  {msg.model && <p style={{ margin: '3px 6px 0', fontSize: '11px', opacity: 0.4 }}>{msg.model}</p>}
                </div>
              ))}
              {loadingChat && <div style={{ opacity: 0.5, fontSize: '13px' }}>LUMI is thinking…</div>}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} style={{ display: 'flex', gap: '10px' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask LUMI anything — video scripts, game design, code, music, production pipelines…" disabled={loadingChat} style={{ ...input, flex: 1, borderRadius: '999px', padding: '12px 18px' }} />
              <button type="submit" disabled={loadingChat || !chatInput.trim()} style={{ ...btn('primary', loadingChat || !chatInput.trim()), borderRadius: '999px', padding: '12px 22px' }}>Send</button>
            </form>
            {chatHistory.length > 0 && (
              <button onClick={() => setChatHistory([])} style={{ ...btn('secondary'), fontSize: '12px', marginTop: '8px' }}>Clear chat</button>
            )}
          </section>
        </div>
      )}

      {/* ── VIDEO CREATOR TAB ──────────────────────────────────────────── */}
      {tab === 'video' && (
        <div style={pageWrap}>
          <section style={heroCard}>
            <h1 style={{ margin: '0 0 6px', fontSize: '22px' }}>🎥 Video Creator</h1>
            <p style={{ margin: 0, opacity: 0.8, fontSize: '14px' }}>AI-generated storyboard → rendered frames → MP4 export. Up to 10 minutes. Download as .mp4</p>
          </section>

          {/* Create form */}
          <section style={card}>
            <h2 style={h2style}>New Video Project</h2>
            <form onSubmit={startVideoCreation} style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={label}>Concept / Script Prompt</label>
                <textarea value={videoConcept} onChange={e => setVideoConcept(e.target.value)} rows={4} style={textarea} placeholder="Describe your video: 'A cinematic intro for TrezzWorld Adventures — showing the world map, key characters, epic battles, and ending with the logo reveal. Upbeat orchestral music, fast cuts, dramatic lighting.'" />
                <p style={hint}>LUMI will generate a detailed shot-by-shot storyboard and render each scene.</p>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={label}>Duration: {fmtDur(videoDuration)} {videoDuration > 60 ? `(${(videoDuration/60).toFixed(1)} min)` : ''}</label>
                  <input type="range" min={5} max={600} step={5} value={videoDuration} onChange={e => setVideoDuration(Number(e.target.value))} style={{ width: '100%', accentColor: '#38bdf8' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.5 }}><span>5s</span><span>5 min</span><span>10 min</span></div>
                </div>
                <div>
                  <label style={label}>Style</label>
                  <select value={videoStyle} onChange={e => setVideoStyle(e.target.value)} style={select}>
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
                  <label style={label}>Resolution</label>
                  <select value={videoResolution} onChange={e => setVideoResolution(e.target.value)} style={select}>
                    <option value="1080p">1080p (1920×1080)</option>
                    <option value="720p">720p (1280×720)</option>
                    <option value="4k">4K (3840×2160)</option>
                    <option value="vertical">Vertical (1080×1920)</option>
                    <option value="square">Square (1080×1080)</option>
                  </select>
                </div>
                <div>
                  <label style={label}>FPS</label>
                  <select value={videoFps} onChange={e => setVideoFps(Number(e.target.value))} style={select}>
                    <option value={24}>24 fps (cinematic)</option>
                    <option value={30}>30 fps (standard)</option>
                    <option value={60}>60 fps (smooth)</option>
                  </select>
                </div>
              </div>

              <div style={{ ...card, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', padding: '12px 16px' }}>
                <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>
                  📋 <strong>Pipeline:</strong> LUMI generates storyboard → Pillow renders frames → FFmpeg encodes MP4.<br/>
                  🖥️ <strong>FFmpeg required</strong> for real MP4: <code>winget install FFmpeg</code> (Win) · <code>brew install ffmpeg</code> (Mac) · <code>apt install ffmpeg</code> (Linux)<br/>
                  🤖 <strong>AI:</strong> SuperGemma 26B (Ollama) if available, otherwise OpenRouter cascade.
                </p>
              </div>

              <div>
                <button type="submit" disabled={creatingVideo || !videoConcept.trim()} style={{ ...btn('primary', creatingVideo || !videoConcept.trim()), padding: '12px 28px', fontSize: '15px' }}>
                  {creatingVideo ? '⏳ Starting…' : '🎬 Create Video'}
                </button>
              </div>
            </form>
          </section>

          {/* Jobs list */}
          {videoJobs.length > 0 && (
            <section style={card}>
              <h2 style={h2style}>Video Projects</h2>
              <div style={{ display: 'grid', gap: '14px' }}>
                {videoJobs.map(job => (
                  <div key={job.jobId} style={{ ...listItem, padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '14px' }}>{job.concept.slice(0, 80)}{job.concept.length > 80 ? '…' : ''}</strong>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.55 }}>{fmtDur(job.durationSeconds)} · {job.style} · {job.resolution} · {job.fps}fps · ID: {job.jobId.slice(0,8)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={pill(job.status)}>{job.status}</span>
                        {job.downloadReady && (
                          <button onClick={() => downloadVideo(job.jobId)} style={{ ...btn('primary'), padding: '6px 14px', fontSize: '12px' }}>⬇ Download MP4</button>
                        )}
                      </div>
                    </div>
                    <ProgressBar pct={job.progress} status={job.status} />
                    <p style={{ ...hint, marginTop: '6px' }}>{job.message || job.status}</p>
                    {job.error && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#fca5a5' }}>⚠️ {job.error}</p>}
                    {job.storyboard && Object.keys(job.storyboard).length > 0 && (
                      <details style={{ marginTop: '10px' }}>
                        <summary style={{ fontSize: '12px', opacity: 0.6, cursor: 'pointer' }}>View storyboard ({job.storyboard.scenes?.length ?? 0} scenes)</summary>
                        <pre style={{ fontSize: '11px', opacity: 0.7, marginTop: '8px', overflow: 'auto', maxHeight: '200px', background: '#06101e', padding: '10px', borderRadius: '8px' }}>{JSON.stringify(job.storyboard, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {videoJobs.length === 0 && (
            <section style={{ ...card, textAlign: 'center', padding: '40px' }}>
              <p style={{ opacity: 0.45, margin: 0 }}>No video projects yet. Fill in the concept above and click Create Video to start.</p>
            </section>
          )}
        </div>
      )}

      {/* ── MODELS TAB ─────────────────────────────────────────────────── */}
      {tab === 'models' && (
        <div style={pageWrap}>
          <section style={heroCard}>
            <h1 style={{ margin: '0 0 6px', fontSize: '22px' }}>🤖 AI Models</h1>
            <p style={{ margin: 0, opacity: 0.8, fontSize: '14px' }}>OpenRouter cloud cascade + local Ollama (SuperGemma 26B). LUMI routes intelligently across all models.</p>
          </section>

          {/* Ollama status */}
          <section style={card}>
            <h2 style={h2style}>🖥️ Ollama — Local Models</h2>
            <div style={{ ...row, flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div style={{ ...card, flex: 1, minWidth: '180px', background: isOllamaUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isOllamaUp ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', opacity: 0.7 }}>Status</p>
                <strong style={{ color: isOllamaUp ? '#86efac' : '#fca5a5' }}>{isOllamaUp ? '✅ Running' : '⚠️ Offline'}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.6 }}>{ollamaStatus?.host ?? 'http://localhost:11434'}</p>
              </div>
              <div style={{ ...card, flex: 1, minWidth: '180px', background: ollamaStatus?.superGemmaReady ? 'rgba(56,189,248,0.08)' : 'rgba(148,163,184,0.05)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', opacity: 0.7 }}>SuperGemma 26B</p>
                <strong style={{ color: ollamaStatus?.superGemmaReady ? '#38bdf8' : '#94a3b8' }}>{ollamaStatus?.superGemmaReady ? '✅ Ready' : '○ Not pulled'}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.6 }}>gemma3:27b</p>
              </div>
              <div style={{ ...card, flex: 1, minWidth: '200px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '12px', opacity: 0.7 }}>Local Models Pulled</p>
                <strong style={{ fontSize: '20px' }}>{ollamaStatus?.localModels.length ?? 0}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.6 }}>{(ollamaStatus?.localModels ?? []).map(m => m.name).join(', ') || 'none'}</p>
              </div>
            </div>

            {!isOllamaUp && (
              <div style={{ ...card, background: 'rgba(250,204,21,0.07)', border: '1px solid rgba(250,204,21,0.2)', padding: '14px 16px' }}>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  <strong style={{ color: '#fde68a' }}>Start Ollama:</strong><br/>
                  <code style={{ opacity: 0.8 }}>ollama serve</code><br/><br/>
                  <strong style={{ color: '#fde68a' }}>Pull SuperGemma 26B:</strong><br/>
                  <code style={{ opacity: 0.8 }}>ollama pull gemma3:27b</code><br/><br/>
                  <strong style={{ color: '#fde68a' }}>Other recommended models:</strong><br/>
                  <code style={{ opacity: 0.8 }}>ollama pull llama3.1:8b  &amp;&amp;  ollama pull mistral:7b</code>
                </p>
              </div>
            )}

            <h3 style={{ fontSize: '13px', opacity: 0.7, marginBottom: '10px' }}>Ollama Model Catalogue</h3>
            <div style={grid}>
              {(ollamaStatus?.catalogue ?? []).map(m => (
                <div key={m.id} style={{ ...listItem, opacity: m.available ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px' }}>{m.label}</strong>
                    <span style={pill(m.available ? 'active' : 'planned')}>{m.available ? '✓ local' : 'not pulled'}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', opacity: 0.55 }}>{m.id} · {m.family}</p>
                </div>
              ))}
            </div>
          </section>

          {/* OpenRouter cascade */}
          <section style={card}>
            <h2 style={h2style}>☁️ OpenRouter Cascade</h2>
            <p style={hint}>Free-first waterfall: Free tier → Low-cost → Premium. Set <code>OPENROUTER_API_KEY</code> in backend/.env</p>
            <div style={{ ...grid, marginTop: '14px', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {openRouterCascade.map(m => (
                <div key={m.id} style={listItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', opacity: 0.85 }}>{m.id.split('/')[1] ?? m.id}</span>
                    <span style={{ ...pill(m.tier === 'free' ? 'active' : m.tier === 'low-cost' ? 'in-progress' : 'planned'), fontSize: '10px' }}>{m.tier}</span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', opacity: 0.45 }}>#{m.priority} · {m.id.split('/')[0]}</p>
                </div>
              ))}
            </div>
          </section>

          {/* LUMI prompt domains */}
          <section style={card}>
            <h2 style={h2style}>✨ LUMI Prompt Enhancement Domains</h2>
            <p style={hint}>Domain-specific system prompts improve creative output quality. Auto-detected from your message, or set manually in Chat.</p>
            <div style={{ ...grid, marginTop: '14px' }}>
              {[
                { id: 'video', label: '🎥 Video Production', desc: 'Film direction, storyboarding, cinematic editing, color grading' },
                { id: 'music', label: '🎵 Music Composition', desc: 'Beats, BPM, arrangement, sound design, mixing' },
                { id: 'game', label: '🎮 Game Design', desc: 'Roblox/Unity/Unreal — mechanics, levels, assets, publishing' },
                { id: 'code', label: '💻 Code Generation', desc: 'Full-stack TypeScript, Python, production-ready files' },
                { id: 'creative', label: '✨ Creative Direction', desc: 'Cross-media concepts, briefs, campaign planning' },
                { id: 'default', label: '🤖 LUMI General', desc: 'Full-spectrum autonomous production AI (default)' },
              ].map(d => (
                <div key={d.id} style={listItem}>
                  <strong style={{ fontSize: '13px' }}>{d.label}</strong>
                  <p style={{ margin: '5px 0 0', fontSize: '12px', opacity: 0.65 }}>{d.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
