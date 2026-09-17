'use client';

import { useCallback, useEffect, useState } from 'react';
import { fieldApiOrigin, getFieldToken } from '../field/map/field-api';
import styles from './qa.module.css';

type Capture = {
  id: string;
  observedName: string;
  status: 'SUBMITTED' | 'VERIFIED';
  location?: { latitude?: number; longitude?: number; accuracyMetres?: number };
  answers?: Record<string, unknown>;
  photoCount: number;
  submittedAt?: string;
  projectTimeZone?: string;
  automatedQa?: {
    outcome?: 'AUTO_VERIFIED' | 'MANUAL_REVIEW';
    checks?: { key: string; passed: boolean; message: string }[];
  };
};

type QueueResponse = { storeCaptures?: Capture[]; message?: string };
type Decision = 'VERIFY' | 'VERIFY_AND_READY' | 'RETURN_FOR_CORRECTION' | 'REJECT' | 'MARK_READY_FOR_EXPORT';

async function authorisedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getFieldToken();
  return fetch(`${fieldApiOrigin()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(displayValue).join(', ');
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>;
    if (typeof item.product === 'string' && typeof item.price === 'number') return `${item.product} · R${item.price.toFixed(2)}`;
    return Object.entries(item).map(([key, nested]) => `${key}: ${displayValue(nested)}`).join(' · ');
  }
  return String(value ?? 'Not answered');
}

export default function QaReviewQueue({ projectId }: { projectId: string }) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('Loading the authorised QA queue…');
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = captures.find((capture) => capture.id === selectedId) ?? captures[0] ?? null;

  const loadQueue = useCallback(async () => {
    setBusy(true);
    setLoadFailed(false);
    try {
      const response = await authorisedFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/store-captures/qa`);
      const result = await response.json() as QueueResponse;
      if (!response.ok) throw new Error(result.message ?? 'The QA queue could not be loaded.');
      const next = result.storeCaptures ?? [];
      setCaptures(next);
      setSelectedId((current) => current && next.some((capture) => capture.id === current) ? current : next[0]?.id ?? null);
      setMessage(next.length ? `${next.length} store capture${next.length === 1 ? '' : 's'} awaiting action.` : 'The store QA queue is clear.');
    } catch (error) { setLoadFailed(true); setMessage(error instanceof Error ? error.message : 'The QA queue could not be loaded.'); }
    finally { setBusy(false); }
  }, [projectId]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  useEffect(() => {
    let activeUrl: string | null = null;
    setPhotoUrl(null);
    if (!selected || selected.photoCount < 1) return;
    void authorisedFetch(`/api/v1/store-captures/${encodeURIComponent(selected.id)}/qa-photos/0`)
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json().catch(() => ({})) as { message?: string };
          throw new Error(result.message ?? 'The evidence photo could not be opened.');
        }
        activeUrl = URL.createObjectURL(await response.blob());
        setPhotoUrl(activeUrl);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'The evidence photo could not be opened.'));
    return () => { if (activeUrl) URL.revokeObjectURL(activeUrl); };
  }, [selected?.id, selected?.photoCount]);

  async function decide(decision: Decision) {
    if (!selected) return;
    if ((decision === 'RETURN_FOR_CORRECTION' || decision === 'REJECT') && reason.trim().length < 5) {
      setMessage('Add a clear reason before returning or rejecting this capture.');
      return;
    }
    setBusy(true);
    setMessage('Saving the QA decision and audit history…');
    try {
      const response = await authorisedFetch(`/api/v1/store-captures/${encodeURIComponent(selected.id)}/qa-decision`, {
        method: 'POST', body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'The QA decision could not be saved.');
      setReason('');
      setMessage(decision === 'VERIFY_AND_READY' || decision === 'MARK_READY_FOR_EXPORT'
        ? 'Verified and ready for controlled export.'
        : decision === 'VERIFY' ? 'Store verified. Export remains blocked until it is marked ready.' : 'QA decision saved with its reason.');
      await loadQueue();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The QA decision could not be saved.'); }
    finally { setBusy(false); }
  }

  return <div className={styles.qaGrid}>
    <section className={styles.queuePanel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>Exception queue</p><h2>Captures needing help</h2></div><button type="button" onClick={() => void loadQueue()} disabled={busy}>Refresh</button></div>
      <p className={styles.statusMessage} role="status">{message}</p>
      <div className={styles.queueList}>{captures.map((capture) => <button className={capture.id === selected?.id ? styles.selected : ''} type="button" key={capture.id} onClick={() => { setSelectedId(capture.id); setReason(''); }}>
        <span><strong>{capture.observedName}</strong><small>{capture.submittedAt ? `${new Date(capture.submittedAt).toLocaleString('en-ZA', { timeZone: capture.projectTimeZone ?? 'Africa/Johannesburg' })} · ${capture.projectTimeZone ?? 'project time'}` : 'Submission time unavailable'}</small></span>
        <b>{capture.status === 'VERIFIED' ? 'Verified' : 'Needs QA'}</b>
      </button>)}</div>
    </section>

    <section className={styles.reviewPanel}>
      {!selected ? <div className={styles.empty}><strong>{loadFailed ? 'The exception queue could not be opened.' : 'No store captures need QA.'}</strong><span>{loadFailed ? 'Check that this signed-in account has the qa.review permission.' : 'Clean captures bypass this queue and proceed to integration automatically.'}</span></div> : <>
        <div className={styles.reviewHead}><div><p className={styles.eyebrow}>Selected store</p><h2>{selected.observedName}</h2></div><span className={selected.status === 'VERIFIED' ? styles.verified : styles.pending}>{selected.status === 'VERIFIED' ? 'Verified' : 'Awaiting QA'}</span></div>
        <div className={styles.evidence}>{photoUrl ? <img src={photoUrl} alt={`Storefront evidence for ${selected.observedName}`} /> : <div>Loading protected photo evidence…</div>}</div>
        <dl className={styles.details}>
          <div><dt>GPS</dt><dd>{selected.location?.latitude?.toFixed(5) ?? '—'}, {selected.location?.longitude?.toFixed(5) ?? '—'}</dd></div>
          <div><dt>Accuracy</dt><dd>{selected.location?.accuracyMetres === undefined ? '—' : `±${Math.round(selected.location.accuracyMetres)} m`}</dd></div>
          {Object.entries(selected.answers ?? {}).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{displayValue(value)}</dd></div>)}
        </dl>
        <section className={styles.autoQa}><div><p className={styles.eyebrow}>Automated QA</p><strong>{selected.automatedQa?.outcome === 'AUTO_VERIFIED' ? 'Automated checks passed' : 'Human review required'}</strong></div>
          <ul>{selected.automatedQa?.checks?.map((check) => <li className={check.passed ? styles.checkPassed : styles.checkReview} key={check.key}><b>{check.passed ? '✓' : '!'}</b><span>{check.message}</span></li>) ?? <li className={styles.checkReview}><b>!</b><span>No automated assessment is recorded for this capture.</span></li>}</ul>
        </section>
        <label className={styles.reason}>Correction or rejection reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required when returning or rejecting a capture" /></label>
        <div className={styles.primaryActions}>{selected.status === 'SUBMITTED' ? <>
          <button type="button" onClick={() => void decide('VERIFY_AND_READY')} disabled={busy}>Verify &amp; make export-ready</button>
          <button type="button" onClick={() => void decide('VERIFY')} disabled={busy}>Verify only</button>
        </> : <button type="button" onClick={() => void decide('MARK_READY_FOR_EXPORT')} disabled={busy}>Mark ready for export</button>}</div>
        <div className={styles.secondaryActions}>
          <button type="button" onClick={() => void decide('RETURN_FOR_CORRECTION')} disabled={busy}>Send back to capturer to redo</button>
          {selected.status === 'SUBMITTED' ? <button className={styles.reject} type="button" onClick={() => void decide('REJECT')} disabled={busy}>Reject store permanently</button> : null}
        </div>
        <p className={styles.guardrail}>This queue contains exceptions only. Resolving one records the human decision and audit history before integration can continue.</p>
      </>}
    </section>
  </div>;
}
