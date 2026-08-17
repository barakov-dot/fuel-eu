import { getWebEnvSafe } from '@/lib/env';

export default function StatusPage() {
  const env = getWebEnvSafe();

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>FuelMap Europe — Status</h1>
      <dl>
        <dt>Frontend</dt>
        <dd>ok</dd>
        <dt>Environment</dt>
        <dd>{env.NODE_ENV}</dd>
        <dt>API base URL</dt>
        <dd>{env.NEXT_PUBLIC_API_BASE_URL}</dd>
      </dl>
    </main>
  );
}
