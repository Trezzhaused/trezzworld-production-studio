import { useEffect, useState } from 'react';

interface BackendStatus {
  status: string;
  version: string;
}

interface MetaDevelopmentPhase {
  id: string;
  name: string;
  status: 'active' | 'in-progress' | 'planned';
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

interface MetaLevel {
  level: number;
  title: string;
  objective: string;
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
  levels: MetaLevel[];
  phases: MetaDevelopmentPhase[];
  productionReadiness: ProductionReadiness;
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaDevelopmentStatus | null>(null);
  const [loadingBackend, setLoadingBackend] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    const backendController = new AbortController();
    const metaController = new AbortController();

    fetch('http://localhost:8000/api/status', { signal: backendController.signal })
      .then((res) => res.json())
      .then((data: BackendStatus) => {
        setBackendStatus(data);
        setLoadingBackend(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setBackendStatus(null);
        setLoadingBackend(false);
      });

    fetch('http://localhost:8000/api/meta-development/status', { signal: metaController.signal })
      .then((res) => res.json())
      .then((data: MetaDevelopmentStatus) => {
        setMetaStatus(data);
        setLoadingMeta(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setMetaStatus(null);
        setLoadingMeta(false);
      });

    return () => {
      backendController.abort();
      metaController.abort();
    };
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>TrezzWorld Production Studio</h1>
      <p>Offline-first creative suite.</p>
      <hr />
      <h2>Backend</h2>
      {loadingBackend ? (
        <p>Connecting…</p>
      ) : backendStatus ? (
        <p>
          ✅ {backendStatus.status} — v{backendStatus.version}
        </p>
      ) : (
        <p>⚠️ Backend not connected. Start it with <code>npm run backend:dev</code>.</p>
      )}
      <hr />
      <h2>Meta Development Engine</h2>
      {loadingMeta ? (
        <p>Loading roadmap…</p>
      ) : metaStatus ? (
        <>
          <p><strong>Highest ROI:</strong> {metaStatus.highestRoiNextMove}</p>
          <p><strong>Production readiness score:</strong> {metaStatus.productionReadiness.score}%</p>

          <h3>Repository intelligence</h3>
          <ul>
            <li>Source files analyzed: {metaStatus.repositoryIntelligence.sourceFiles}</li>
            <li>TODO/FIXME markers: {metaStatus.repositoryIntelligence.todoMarkers}</li>
            <li>Architecture detected: {metaStatus.repositoryIntelligence.architectureDetected ? 'Yes' : 'No'}</li>
            <li>Missing npm test script: {metaStatus.repositoryIntelligence.missingTestScript ? 'Yes' : 'No'}</li>
          </ul>

          <h3>Phases</h3>
          <ul>
            {metaStatus.phases.map((phase) => (
              <li key={phase.id}>
                {phase.name} — <strong>{phase.status}</strong>
              </li>
            ))}
          </ul>

          <h3>Level targets</h3>
          <ul>
            {metaStatus.levels.map((level) => (
              <li key={level.level}>
                Level {level.level}: {level.title}
              </li>
            ))}
          </ul>

          <h3>Readiness checks</h3>
          <ul>
            {metaStatus.productionReadiness.checks.map((check) => (
              <li key={check.category}>
                {check.category} ({check.goal}) — {check.passed ? '✅' : '❌'}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>⚠️ Meta development status unavailable.</p>
      )}
    </div>
  );
}
