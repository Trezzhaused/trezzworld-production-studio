import { useEffect, useState } from 'react';

interface BackendStatus {
  status: string;
  version: string;
}

export default function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/api/status')
      .then((res) => res.json())
      .then((data: BackendStatus) => {
        setBackendStatus(data);
        setLoading(false);
      })
      .catch(() => {
        setBackendStatus(null);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>TrezzWorld Production Studio</h1>
      <p>Offline-first creative suite.</p>
      <hr />
      <h2>Backend</h2>
      {loading ? (
        <p>Connecting…</p>
      ) : backendStatus ? (
        <p>
          ✅ {backendStatus.status} — v{backendStatus.version}
        </p>
      ) : (
        <p>⚠️ Backend not connected. Start it with <code>npm run backend:dev</code>.</p>
      )}
    </div>
  );
}

