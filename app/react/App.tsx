import { FormEvent, useEffect, useState } from 'react';

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
  actionId: string;
  name: string;
  workerId: string;
  status: string;
  stage: string;
  targetFiles: string[];
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
  status: string;
  approvalRequired: boolean;
  summary: string;
  requestedCapabilities: CapabilityProvider[];
  executionQueue: QueueItem[];
  executionPlan: string[];
  selectedActions: MetaBuilderAction[];
}

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
    status === 'active' || status === 'ready' || status === 'running'
      ? 'rgba(34,197,94,0.2)'
      : status === 'in-progress' || status === 'standby' || status === 'scheduled'
        ? 'rgba(250,204,21,0.18)'
        : 'rgba(148,163,184,0.18)',
  color:
    status === 'active' || status === 'ready' || status === 'running'
      ? '#86efac'
      : status === 'in-progress' || status === 'standby' || status === 'scheduled'
        ? '#fde68a'
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

  useEffect(() => {
    const controller = new AbortController();

    const fetchJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return response.json() as Promise<T>;
    };

    Promise.all([
      fetchJson<BackendStatus>('http://localhost:8000/api/status'),
      fetchJson<MetaDevelopmentStatus>('http://localhost:8000/api/meta-development/status'),
      fetchJson<MetaBuilderStatus>('http://localhost:8000/api/meta-builder/status'),
      fetchJson<ControlPlaneStatus>('http://localhost:8000/api/studio/control-plane'),
    ])
      .then(([backend, meta, metaBuilder, studio]) => {
        setBackendStatus(backend);
        setMetaStatus(meta);
        setMetaBuilderStatus(metaBuilder);
        setControlPlane(studio);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setBackendStatus(null);
        setMetaStatus(null);
        setMetaBuilderStatus(null);
        setControlPlane(null);
      });

    return () => controller.abort();
  }, []);

  const bootMission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingMission(true);
    try {
      const response = await fetch('http://localhost:8000/api/studio/control-plane/boot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: missionPrompt }),
      });
      if (!response.ok) {
        throw new Error(`Mission boot failed: ${response.status}`);
      }
      const payload = (await response.json()) as MissionBootResult;
      setMissionBoot(payload);
    } catch {
      setMissionBoot(null);
    } finally {
      setLoadingMission(false);
    }
  };

  const readiness = controlPlane?.productionReadiness.score ?? metaStatus?.productionReadiness.score ?? 0;

  return (
    <div style={shellStyle}>
      <div style={pageStyle}>
        <section style={heroStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: '0 0 8px', opacity: 0.8 }}>LUMI Control Plane</p>
              <h1 style={{ margin: 0 }}>{controlPlane?.workspaceTitle ?? 'TrezzWorld Production Studio'}</h1>
              <p style={{ maxWidth: '880px', lineHeight: 1.6, opacity: 0.9 }}>
                {controlPlane?.finishLine ??
                  'A single prompt can produce an end-to-end deliverable with minimal human intervention.'}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <p style={{ margin: 0, opacity: 0.75 }}>
                  Boot the basic studio shell now so LUMI can continue building UI, assets, media, storefront, and checkout.
                </p>
                <button
                  type="submit"
                  disabled={loadingMission}
                  style={{
                    background: '#38bdf8',
                    color: '#04111f',
                    border: 0,
                    borderRadius: '999px',
                    padding: '12px 18px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {loadingMission ? 'Booting mission…' : 'Boot LUMI mission'}
                </button>
              </div>
            </form>
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
              {(missionBoot?.executionQueue ?? controlPlane?.executionQueue ?? []).map((job) => (
                <li key={job.jobId} style={itemStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <strong>{job.name}</strong>
                    <span style={pillStyle(job.status)}>{job.status}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', opacity: 0.78 }}>
                    {job.workerId} · {job.stage} · {job.targetFiles.length} target file(s)
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

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
