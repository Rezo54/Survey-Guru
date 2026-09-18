'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldApiOrigin, getFieldToken } from '../field/map/field-api';
import styles from './qa.module.css';

type Capture = {
  id: string;
  observedName: string;
  status: 'SUBMITTED' | 'VERIFIED' | 'READY_FOR_EXPORT' | 'SYNCED' | 'REJECTED';
  location?: { latitude?: number; longitude?: number; accuracyMetres?: number };
  answers?: Record<string, unknown>;
  photoCount: number;
  submittedAt?: string;
  projectTimeZone?: string;
  automatedQa?: {
    outcome?: 'AUTO_VERIFIED' | 'MANUAL_REVIEW';
    checks?: { key: string; passed: boolean; message: string }[];
  };
  qaReviewRequested?: boolean;
  qaReviewReason?: string | null;
  preQaStatus?: string | null;
  reconciliationRequired?: boolean;
  rejectionReason?: string | null;
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
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const [actionMessage,setActionMessage]=useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('Loading the authorised QA queue…');
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'exceptions' | 'rejected' | 'all'>('exceptions');
  const selected = captures.find((capture) => capture.id === selectedId) ?? captures[0] ?? null;

  const loadQueue = useCallback(async () => {
    setBusy(true);
    setLoadFailed(false);
    try {
      const response = await authorisedFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/store-captures/qa?view=${view}`);
      const result = await response.json() as QueueResponse;
      if (!response.ok) throw new Error(result.message ?? 'The QA queue could not be loaded.');
      const next = result.storeCaptures ?? [];
      setCaptures(next);
      setSelectedId((current) => current && next.some((capture) => capture.id === current) ? current : next[0]?.id ?? null);
      setMessage(next.length ? `${next.length} ${view === 'rejected' ? 'rejected store reconciliation record' : 'store capture'}${next.length === 1 ? '' : 's'}${view === 'exceptions' ? ' awaiting action' : ''}.` : view === 'rejected' ? 'No rejected stores are recorded for this project.' : 'The store QA queue is clear.');
    } catch (error) { setLoadFailed(true); setMessage(error instanceof Error ? error.message : 'The QA queue could not be loaded.'); }
    finally { setBusy(false); }
  }, [projectId, view]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);
  useEffect(() => {
    const refresh = () => { if (!busy && !reason.trim() && document.visibilityState === 'visible') void loadQueue(); };
    const storage = (event: StorageEvent) => { if (event.key === 'survey-guru:qa-changed') refresh(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); window.addEventListener('survey-guru-qa-changed', refresh); window.addEventListener('storage', storage);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('survey-guru-qa-changed', refresh); window.removeEventListener('storage', storage); };
  }, [loadQueue, busy, reason]);

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
    if (!selected || busy) return;
    setActionMessage('');
    if ((decision === 'RETURN_FOR_CORRECTION' || decision === 'REJECT') && reason.trim().length < 5) {
      setActionMessage('Enter a correction or rejection reason of at least 5 characters.');
      reasonInput.current?.focus();
      reasonInput.current?.scrollIntoView({block:'center',behavior:'smooth'});
      return;
    }
    setBusy(true);
    setMessage('Saving the QA decision and audit history…'); setActionMessage('Saving the QA decision…');
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
      setActionMessage(decision === 'RETURN_FOR_CORRECTION' ? 'Store returned. The capturer can see the correction request in Field Today.' : 'QA decision saved.');
    } catch (error) { setActionMessage(error instanceof Error ? error.message : 'The QA decision could not be saved.'); }
    finally { setBusy(false); }
  }

  async function downloadRejected() {
    setBusy(true);
    try {
      const response = await authorisedFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/store-captures/export.xlsx?status=REJECTED`);
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { message?: string }; throw new Error(result.message ?? 'The rejected-store reconciliation file could not be downloaded.'); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${projectId}-rejected-store-reconciliation.xlsx`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The rejected-store reconciliation file could not be downloaded.'); }
    finally { setBusy(false); }
  }

  return <div className={styles.qaGrid}>
    <section className={styles.queuePanel}>
      <div className={styles.panelHead}><div><p className={styles.eyebrow}>Exception queue</p><h2>{view === 'rejected' ? 'Rejected reconciliation' : 'Captures needing help'}</h2></div><button type="button" onClick={() => void loadQueue()} disabled={busy}>Refresh</button></div>
      <div className={styles.queueTabs}><button type="button" onClick={() => setView('all')} className={view === 'all' ? styles.selectedTab : ''}>All submitted customers</button><button type="button" className={view === 'exceptions' ? styles.selectedTab : ''} onClick={() => setView('exceptions')}>Needs review</button><button type="button" className={view === 'rejected' ? styles.selectedTab : ''} onClick={() => setView('rejected')}>Rejected stores</button>{view === 'rejected' ? <button type="button" onClick={() => void downloadRejected()} disabled={busy}>⇩ Download rejected</button> : null}</div>
      <p className={styles.statusMessage} role="status">{message}</p>
      <div className={styles.queueList}>{captures.map((capture) => <button className={capture.id === selected?.id ? styles.selected : ''} type="button" key={capture.id} onClick={() => { setSelectedId(capture.id); setReason(''); setActionMessage(''); }}>
        <span><strong>{capture.observedName}</strong><small>{capture.submittedAt ? `${new Date(capture.submittedAt).toLocaleString('en-ZA', { timeZone: capture.projectTimeZone ?? 'Africa/Johannesburg' })} · ${capture.projectTimeZone ?? 'project time'}` : 'Submission time unavailable'}</small></span>
        <b>{capture.status === 'REJECTED' ? 'Rejected' : capture.qaReviewRequested ? 'Post-submit QA' : capture.status === 'VERIFIED' ? 'Verified' : 'Needs QA'}</b>
      </button>)}</div>
    </section>

    <section className={styles.reviewPanel} aria-busy={busy}>
        {actionMessage && <p role="alert" className={styles.statusMessage}>{actionMessage}</p>}
      {!selected ? <div className={styles.empty}><strong>{loadFailed ? 'The exception queue could not be opened.' : 'No store captures need QA.'}</strong><span>{loadFailed ? 'Check that this signed-in account has the qa.review permission.' : 'Clean captures bypass this queue and proceed to integration automatically.'}</span></div> : <>
        <div className={styles.reviewHead}><div><p className={styles.eyebrow}>Selected store</p><h2>{selected.observedName}</h2></div><span className={!selected.qaReviewRequested && selected.status === 'VERIFIED' ? styles.verified : styles.pending}>{selected.qaReviewRequested ? 'Awaiting QA review' : selected.status === 'REJECTED' ? 'Rejected' : selected.status === 'VERIFIED' ? 'Verified' : 'Awaiting QA'}</span></div>
        <div className={styles.evidence}>{photoUrl ? <img src={photoUrl} alt={`Storefront evidence for ${selected.observedName}`} /> : <div>Loading protected photo evidence…</div>}</div>
        <dl className={styles.details}>
          <div><dt>GPS</dt><dd>{selected.location?.latitude?.toFixed(5) ?? '—'}, {selected.location?.longitude?.toFixed(5) ?? '—'}</dd></div>
          <div><dt>Accuracy</dt><dd>{selected.location?.accuracyMetres === undefined ? '—' : `±${Math.round(selected.location.accuracyMetres)} m`}</dd></div>
          {selected.qaReviewReason ? <div><dt>Review anomaly</dt><dd>{selected.qaReviewReason}</dd></div> : null}
          {selected.rejectionReason ? <div><dt>Rejection reason</dt><dd>{selected.rejectionReason}</dd></div> : null}
          {selected.preQaStatus ? <div><dt>Before QA</dt><dd>{selected.preQaStatus.replaceAll('_', ' ')}</dd></div> : null}
          {selected.reconciliationRequired ? <div><dt>Third-party reconciliation</dt><dd>Required — the store had already entered the hand-off process.</dd></div> : null}
          {Object.entries(selected.answers ?? {}).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{displayValue(value)}</dd></div>)}
        </dl>
        <section className={styles.autoQa}><div><p className={styles.eyebrow}>Automated QA</p><strong>{selected.automatedQa?.outcome === 'AUTO_VERIFIED' ? 'Automated checks passed' : 'Human review required'}</strong></div>
          <ul>{selected.automatedQa?.checks?.map((check) => <li className={check.passed ? styles.checkPassed : styles.checkReview} key={check.key}><b>{check.passed ? '✓' : '!'}</b><span>{check.message}</span></li>) ?? <li className={styles.checkReview}><b>!</b><span>No automated assessment is recorded for this capture.</span></li>}</ul>
        </section>
        {view === 'exceptions' ? <><label className={styles.reason}>Correction or rejection reason<textarea ref={reasonInput} disabled={busy} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required when returning or rejecting a capture" /></label>
        {selected.qaReviewRequested ? <><div className={styles.primaryActions}><button type="button" onClick={() => void decide('VERIFY')} disabled={busy}>Verify only</button></div><div className={styles.secondaryActions}><button type="button" onClick={() => void decide('RETURN_FOR_CORRECTION')} disabled={busy}>Send back to capturer to redo</button><button className={styles.reject} type="button" onClick={() => void decide('REJECT')} disabled={busy}>Reject store permanently</button></div></> : <><div className={styles.primaryActions}>{selected.status === 'SUBMITTED' ? <>
          <button type="button" onClick={() => void decide('VERIFY_AND_READY')} disabled={busy}>Verify &amp; make export-ready</button>
          <button type="button" onClick={() => void decide('VERIFY')} disabled={busy}>Verify only</button>
        </> : <button type="button" onClick={() => void decide('MARK_READY_FOR_EXPORT')} disabled={busy}>Mark ready for export</button>}</div>
        <div className={styles.secondaryActions}>
          <button type="button" onClick={() => void decide('RETURN_FOR_CORRECTION')} disabled={busy}>Send back to capturer to redo</button>
          {selected.status === 'SUBMITTED' ? <button className={styles.reject} type="button" onClick={() => void decide('REJECT')} disabled={busy}>Reject store permanently</button> : null}
        </div></>}</> : null}
        {actionMessage && <p role="status" className={styles.statusMessage}>{actionMessage}</p>}<p className={styles.guardrail}>This queue contains exceptions only. Resolving one records the human decision and audit history before integration can continue.</p>
      </>}
    </section>
  </div>;
}
