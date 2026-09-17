'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fieldApiOrigin, getFieldToken } from './map/field-api';
import styles from './field-today.module.css';

export default function SearchSessionLauncher({ assignmentId, compact = false }: { assignmentId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOrResume() {
    setBusy(true);
    setError(null);
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/assignments/${encodeURIComponent(assignmentId)}/search-session`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { searchSession?: { id?: string }; message?: string };
      if (!response.ok || !body.searchSession?.id) throw new Error(body.message ?? 'Search session could not be started.');
      router.push(`/field/map?session=${encodeURIComponent(body.searchSession.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search session could not be started.');
    } finally {
      setBusy(false);
    }
  }

  return <div className={compact ? styles.queueAction : undefined}><button type="button" className={compact ? styles.assignmentAction : styles.heroAction} onClick={startOrResume} disabled={busy}>{busy ? 'Opening…' : compact ? 'Open assignment →' : 'Start / resume field map →'}</button>{error ? <small className={styles.assignmentError}>{error}</small> : null}</div>;
}
