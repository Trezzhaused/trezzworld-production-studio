import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

interface BackendStatus {
  status: string;
  version: string;
}

interface ReadinessCheck {
  category: string;
  goal: string;
  passed: boolean;
}

interface ProductionReadiness {
  score: number;
  checks: ReadinessCheck[];
}

interface MetaDevelopmentPhase {
  id: string;
  name: string;
  status: 'active' | 'in-progress' | 'planned';
}

interface RepositoryIntelligenceSummary {
  sourceFiles: number;
  todoMarkers: number;
  architectureDetected: boolean;
  missingTestScript: boolean;
}

interface MetaDevelopmentStatus {
  highestRoiNextMove: string;
  currentReality: string[];
  repositoryIntelligence: RepositoryIntelligenceSummary;
  phases: MetaDevelopmentPhase[];
  productionReadiness: ProductionReadiness;
}

interface MetaBuilderAction {
  id: string;
  title: string;
  objective: string;
  targetFiles: string[];
}

interface MetaBuilderGap {
  phaseId: string;
  phaseName: string;
  priority: number;
  missingFiles: string[];
}

interface TodoHotspot {
  path: string;
  markers: number;
}

interface MetaBuilderStatus {
  summary: string;
  readinessEstimate: number;
  nextActions: MetaBuilderAction[];
  phaseGaps: MetaBuilderGap[];
  todoHotspots: TodoHotspot[];
}

interface WorkspaceModule {
  id: string;
  name: string;
  status: 'active' | 'in-progress' | 'planned';
  description: string;
}

interface CapabilityProvider {
  capability: string;
  providerId: string;
  providerKind: string;
  status: string;
  route: string;
}

interface QueueItem {
  jobId: string;
  actionId?: string;
  name: string;
  workerId: string;
  status: string;
  stage: string;
  targetFiles: string[];
  score?: number;
  error?: string;
}

interface DeliverySurface {
  name: string;
  status: 'active' | 'in-progress' | 'planned';
}

interface ControlPlaneStatus {
  workspaceTitle: string;
  finishLine: string;
  missionPromptPlaceholder: string;
  workspaceModules: WorkspaceModule[];
  capabilityProviders: CapabilityProvider[];
  executionQueue: QueueItem[];
  deliverySurfaces: DeliverySurface[];
  productionReadiness: ProductionReadiness;
  metaBuilder: {
    summary: string;
    readinessEstimate: number;
    nextActions: MetaBuilderAction[];
  };
}

interface MissionBootResult {
  objective: string;
  missionId?: string;
  status: string;
  approvalRequired: boolean;
  summary: string;
  plannerModel?: string;
  requestedCapabilities: CapabilityProvider[];
  executionQueue: QueueItem[];
  executionPlan: string[];
  selectedActions: MetaBuilderAction[];
}

interface PipelineProgress {
  total: number;
  completed: number;
  running: number;
  errored: number;
  percent: number;
}

interface PipelineStatus {
  id: string;
  status: string;
  summary: string;
  jobs: QueueItem[];
  progress: PipelineProgress;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
}

const API = 'http://localhost:8000';

const shellStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#07111f',
  color: '#e8eefc',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '24px',
};

const pageStyle: React.CSSProperties = {
  maxWidth: '1400px',
  margin: '0 auto',
  display: 'grid',
  gap: '16px',
};

const heroStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #13233d, #0b4d7a)',
  borderRadius: '20px',
  padding: '24px',
  border: '1px solid rgba(255,255,255,0.1)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '16px',
};

const panelStyle: React.CSSProperties = {
  background: '#0c1729',
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
};

const pillStyle = (status: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  background:
    status === 'active' || status === 'ready' || status === 'running' || status === 'done'
      ? 'rgba(34,197,94,0.2)'
      : status === 'in-progress' || status === 'standby' || status === 'scheduled' || status === 'warn'
        ? 'rgba(250,204,21,0.18)'
        : status === 'error' || status === 'failed'
          ? 'rgba(239,68,68,0.2)'
          : 'rgba(148,163,184,0.18)',
  color:
    status === 'active' || status === 'ready' || status === 'running' || status === 'done'
      ? '#86efac'
      : status === 'in-progress' || status === 'standby' || status === 'scheduled' || status === 'warn'
        ? '#fde68a'
        : status === 'error' || status === 'failed'
          ? '#fca5a5'
          : '#cbd5e1',
});

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '10px',
};

const itemStyle: React.CSSProperties = {
  padding: '12px 14px',
  background: 'rgba(15, 23, 42, 0.65)',
  borderRadius: '14px',
  border: '1px solid rgba(148,163,184,0.12)',
};

export default function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaDevelopmentStatus | null>(null);
  const [metaBuilderStatus, setMetaBuilderStatus] = useState<MetaBuilderStatus | null>(null);
  const [controlPlane, setControlPlane] = useState<ControlPlaneStatus | null>(null);
  const [missionPrompt, setMissionPrompt] = useState(
    'Build a Roblox game called TrezzWorld Adventures, create original 3D assets, music, voice acting, a 5-minute cinematic trailer, website, documentation, marketing campaign, and prepare everything for publishing.',
  );
  const [missionBoot, setMissionBoot] = useState<MissionBootResult | null>(null);
  const [loadingMission, setLoadingMission] = useState(false);

  // Live pipeline execution tracking
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // LUMI chat
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json() as Promise<T>;
    };

    Promise.all([
      fetchJson<BackendStatus>(`${API}/api/status`),
      fetchJson<MetaDevelopmentStatus>(`${API}/api/meta-development/status`),
      fetchJson<MetaBuilderStatus>(`${API}/api/meta-builder/status`),
      fetchJson<ControlPlaneStatus>(`${API}/api/studio/control-plane`),
    ])
      .then(([backend, meta, metaBuilder, studio]) => {
        setBackendStatus(backend);
        setMetaStatus(meta);
        setMetaBuilderStatus(metaBuilder);
        setControlPlane(studio);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setBackendStatus(null);
        setMetaStatus(null);
        setMetaBuilderStatus(null);
        setControlPlane(null);
      });

    return () => controller.abort();
  }, []);

  // Pipeline status polling
  const startPolling = useCallback((missionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/pipeline/${encodeURIComponent(missionId)}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as PipelineStatus;
        setPipelineStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch {
        // backend may not be running
      }
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const bootMission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingMission(true);
    try {
      const response = await fetch(`${API}/api/studio/control-plane/boot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: missionPrompt }),
      });
      if (!response.ok) throw new Error(`Mission boot failed: ${response.status}`);
      const payload = (await response.json()) as MissionBootResult;
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

  const sendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setChatInput('');
    setLoadingChat(true);
    try {
      const res = await fetch(`${API}/api/lumi/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          missionId: activeMissionId,
          history: chatHistory.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
      const data = (await res.json()) as { content: string; model: string; ok: boolean };
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: data.content, model: data.model },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ LUMI is unavailable. Set OPENROUTER_API_KEY to enable AI responses.' },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const activeQueue = pipelineStatus?.jobs ?? missionBoot?.executionQueue ?? controlPlane?.executionQueue ?? [];
  const readiness = controlPlane?.productionReadiness.score ?? metaStatus?.productionReadiness.score ?? 0;
  const pipelineRunning = pipelineStatus && pipelineStatus.status === 'running';
  const pipelinePercent = pipelineStatus?.progress.percent ?? 0;

  return (
    <div style={shellStyle}>
      <div style={pageStyle}>

        {/* Hero */}
        <section style={heroStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 8px', opacity: 0.8 }}>LUMI Control Plane</p>
              <h1 style={{ margin: 0 }}>{controlPlane?.workspaceTitle ?? 'TrezzWorld Production Studio'}</h1>
              <p style={{ maxWidth: '880px', lineHeight: 1.6, opacity: 0.9 }}>
                {controlPlane?.finishLine ?? 'A single prompt can produce an end-to-end deliverable with minimal human intervention.'}
              </p>
            </div>
            <div style={{ minWidth: '240px' }}>
              <div style={panelStyle}>
                <p style={{ margin: '0 0 8px' }}>Backend</p>
                <strong>{backendStatus ? `✅ ${backendStatus.status}` : '⚠️ offline'}</strong>
                <p style={{ marginBottom: 0, opacity: 0.75 }}>v{backendStatus?.version ?? 'n/a'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats row */}
        <section style={gridStyle}>
          <div style={panelStyle}>
            <p style={{ marginTop: 0, opacity: 0.8 }}>Production readiness</p>
            <h2 style={{ margin: '0 0 8px' }}>{readiness}%</h2>
            <p style={{ margin: 0, opacity: 0.75 }}>{metaBuilderStatus?.summary ?? 'Waiting for repository analysis.'}</p>
          </div>
          <div style={panelStyle}>
            <p style={{ marginTop: 0, opacity: 0.8 }}>Source intelligence</p>
            <h2 style={{ margin: '0 0 8px' }}>{metaStatus?.repositoryIntelligence.sourceFiles ?? 0}</h2>
            <p style={{ margin: 0, opacity: 0.75 }}>
              Files analyzed · TODO markers {metaStatus?.repositoryIntelligence.todoMarkers ?? 0}
            </p>
          </div>
          <div style={panelStyle}>
            <p style={{ marginTop: 0, opacity: 0.8 }}>MetaBuilder autonomy</p>
            <h2 style={{ margin: '0 0 8px' }}>{metaBuilderStatus?.readinessEstimate ?? 0}%</h2>
            <p style={{ margin: 0, opacity: 0.75 }}>Goal: ready-to-start studio shell for full LUMI build-out.</p>
          </div>
          <div style={panelStyle}>
            <p style={{ marginTop: 0, opacity: 0.8 }}>Next ROI move</p>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{metaStatus?.highestRoiNextMove ?? 'Waiting for backend.'}</p>
          </div>
        </section>

        {/* Mission launcher + active pipeline progress */}
        <section style={gridStyle}>
          <div style={{ ...panelStyle, gridColumn: 'span 2' }}>
            <h2 style={{ marginTop: 0 }}>Mission launcher</h2>
            <form onSubmit={bootMission} style={{ display: 'grid', gap: '12px' }}>
              <textarea
                value={missionPrompt}
                onChange={(event) => setMissionPrompt(event.target.value)}
                rows={5}
                style={{
                  width: '100%',
                  borderRadius: '14px',
                  border: '1px solid rgba(148,163,184,0.2)',
                  background: '#07111f',
                  color: '#e8eefc',
                  padding: '14px',
                  resize: 'vertical',
                }}
                placeholder={controlPlane?.missionPromptPlaceholder}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, opacity: 0.75 }}>
                    {missionBoot
                      ? `🚀 Mission ${missionBoot.missionId ?? ''} is ${missionBoot.status} via ${missionBoot.plannerModel ?? 'cascade'}.`
                      : 'Boot the studio shell — LUMI will execute real pipeline tasks and write files.'}
                  </p>
                  {pipelineRunning && (
                    <p style={{ margin: '6px 0 0', color: '#86efac', fontSize: '13px' }}>
                      ⚡ Executing: {pipelineStatus!.progress.completed}/{pipelineStatus!.progress.total} jobs complete ({pipelinePercent}%)
                    </p>
                  )}
                  {pipelineStatus?.status === 'completed' && (
                    <p style={{ margin: '6px 0 0', color: '#86efac', fontSize: '13px' }}>
                      ✅ {pipelineStatus.summary}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loadingMission}
                  style={{
                    background: loadingMission ? '#1e3a5f' : '#38bdf8',
                    color: '#04111f',
                    border: 0,
                    borderRadius: '999px',
                    padding: '12px 18px',
                    fontWeight: 800,
                    cursor: loadingMission ? 'wait' : 'pointer',
                  }}
                >
                  {loadingMission ? 'Booting mission…' : 'Boot LUMI mission'}
                </button>
              </div>
            </form>

            {/* Progress bar */}
            {pipelineStatus && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pipelinePercent}%`,
                    height: '100%',
                    background: pipelineStatus.status === 'completed' ? '#86efac' : pipelineStatus.status === 'failed' ? '#fca5a5' : '#38bdf8',
                    transition: 'width 0.6s ease',
                    borderRadius: '999px',
                  }} />
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', opacity: 0.65 }}>
                  {pipelineStatus.progress.completed} done · {pipelineStatus.progress.running} running · {pipelineStatus.progress.errored} errors
                </p>
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Delivery surfaces</h2>
            <ul style={listStyle}>
              {(controlPlane?.deliverySurfaces ?? []).map((surface) => (
                <li key={surface.name} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <strong>{surface.name}</strong>
                    <span style={pillStyle(surface.status)}>{surface.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* LUMI Chat */}
        <section style={{ ...panelStyle }}>
          <h2 style={{ marginTop: 0 }}>💬 Chat with LUMI</h2>
          <p style={{ margin: '0 0 12px', opacity: 0.7, fontSize: '13px' }}>
            Free-first AI cascade: Gemini → DeepSeek → Llama → Mistral → Claude → GPT.
            Set <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '6px' }}>OPENROUTER_API_KEY</code> in backend to enable.
          </p>
          <div style={{
            minHeight: '200px',
            maxHeight: '380px',
            overflowY: 'auto',
            background: '#07111f',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '12px',
            display: 'grid',
            gap: '10px',
            alignContent: 'start',
          }}>
            {chatHistory.length === 0 && (
              <p style={{ opacity: 0.45, margin: 0 }}>Ask LUMI anything about the build, pipeline status, or next steps…</p>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  background: msg.role === 'user' ? 'rgba(56,189,248,0.18)' : 'rgba(148,163,184,0.12)',
                  color: '#e8eefc',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
                {msg.model && (
                  <p style={{ margin: '3px 4px 0', fontSize: '11px', opacity: 0.45 }}>{msg.model}</p>
                )}
              </div>
            ))}
            {loadingChat && (
              <div style={{ opacity: 0.5, fontSize: '13px' }}>LUMI is thinking…</div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendChat} style={{ display: 'flex', gap: '10px' }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask LUMI to plan, build, explain, or execute…"
              disabled={loadingChat}
              style={{
                flex: 1,
                background: '#07111f',
                border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '999px',
                color: '#e8eefc',
                padding: '12px 18px',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              disabled={loadingChat || !chatInput.trim()}
              style={{
                background: '#38bdf8',
                color: '#04111f',
                border: 0,
                borderRadius: '999px',
                padding: '12px 20px',
                fontWeight: 800,
                cursor: loadingChat ? 'wait' : 'pointer',
              }}
            >
              Send
            </button>
          </form>
        </section>

        {/* Execution queue */}
        <section style={gridStyle}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Workspace modules</h2>
            <ul style={listStyle}>
              {(controlPlane?.workspaceModules ?? []).map((module) => (
                <li key={module.id} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <strong>{module.name}</strong>
                    <span style={pillStyle(module.status)}>{module.status}</span>
                  </div>
                  <p style={{ marginBottom: 0, opacity: 0.78 }}>{module.description}</p>
                </li>
              ))}
            </ul>
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Capability router</h2>
            <ul style={listStyle}>
              {(missionBoot?.requestedCapabilities ?? controlPlane?.capabilityProviders ?? []).map((provider) => (
                <li key={`${provider.capability}-${provider.providerId}`} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <strong>{provider.capability}</strong>
                    <span style={pillStyle(provider.status)}>{provider.status}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', opacity: 0.78 }}>
                    {provider.providerId} · {provider.providerKind} · route {provider.route}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Execution queue</h2>
            <ul style={listStyle}>
              {activeQueue.map((job) => (
                <li key={job.jobId ?? job.actionId} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <strong>{job.name}</strong>
                    <span style={pillStyle(job.status)}>{job.status}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', opacity: 0.78 }}>
                    {job.workerId} · {job.stage} · {(job.targetFiles ?? []).length} file(s)
                    {job.score !== null && job.score !== undefined && ` · score ${job.score.toFixed(2)}`}
                  </p>
                  {job.error && (
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#fca5a5' }}>{job.error}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Autonomous action batch + execution loop */}
        <section style={gridStyle}>
          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Autonomous action batch</h2>
            <ul style={listStyle}>
              {(missionBoot?.selectedActions ?? metaBuilderStatus?.nextActions ?? []).map((action) => (
                <li key={action.id} style={itemStyle}>
                  <strong>{action.title}</strong>
                  <p style={{ margin: '8px 0 10px', opacity: 0.78 }}>{action.objective}</p>
                  <p style={{ margin: 0, fontSize: '12px', opacity: 0.65 }}>{action.targetFiles.join(', ')}</p>
                </li>
              ))}
            </ul>
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Execution loop</h2>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '10px' }}>
              {(missionBoot?.executionPlan ?? [
                'Observe repository and detect capability gaps',
                'Prioritize missing components by phase and impact',
                'Generate implementation tasks with acceptance criteria',
                'Execute tasks through autonomous code and asset agents',
                'Run validation, repair failures, and re-validate',
                'Document deltas and prepare commit candidate for human approval',
              ]).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          <div style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Gap hotspots</h2>
            <ul style={listStyle}>
              {(metaBuilderStatus?.todoHotspots ?? []).slice(0, 5).map((hotspot) => (
                <li key={hotspot.path} style={itemStyle}>
                  <strong>{hotspot.path}</strong>
                  <p style={{ margin: '8px 0 0', opacity: 0.78 }}>{hotspot.markers} TODO/FIXME marker(s)</p>
                </li>
              ))}
              {(metaBuilderStatus?.phaseGaps ?? []).slice(0, 3).map((gap) => (
                <li key={gap.phaseId} style={itemStyle}>
                  <strong>{gap.phaseName}</strong>
                  <p style={{ margin: '8px 0 0', opacity: 0.78 }}>
                    Priority {gap.priority} · missing {gap.missingFiles.join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Readiness checks */}
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Readiness checks</h2>
          <div style={gridStyle}>
            {(metaStatus?.productionReadiness.checks ?? []).map((check) => (
              <div key={check.category} style={itemStyle}>
                <strong>{check.category}</strong>
                <p style={{ margin: '8px 0 4px', opacity: 0.75 }}>Goal: {check.goal}</p>
                <span style={pillStyle(check.passed ? 'ready' : 'planned')}>{check.passed ? 'passed' : 'pending'}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
