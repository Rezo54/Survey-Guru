'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fieldApiOrigin, getFieldToken } from './field-api';
import feedbackStyles from './FieldFeedback.module.css';
import SharedStreetCoverageMap from './SharedStreetCoverageMap';
import s from './field-map.module.css';

type Session = { id: string; projectId?: string; areaName?: string; state?: string; coverageState?: string; searchedKm?: number; partialKm?: number; unknownKm?: number; queuedEvidenceCount?: number };
type MovementEvent = { id: string; capturedAt: string; accuracyMetres: number; source: string; validationStatus: string; validationReason?: string; mapMatchStatus?: string };
type TraversalSummary = { acceptedPointCount: number; segmentCount: number; supportedSegmentCount: number; supportedTraversalKm: number; derivationStatus: string; coverageDerived: boolean; coverageReason: string };
type EvidenceSummary = { count: number; acceptedCount: number; rejectedCount: number; coverageState: string; searchedKm: number; traversal: TraversalSummary };
type CoverageResult = { changed?: boolean; matchOutcome?: string; persistence?: string; reason?: string };
type FeedbackTone = 'success' | 'info' | 'warning' | 'danger';
type FieldFeedback = { title: string; detail: string; tone: FeedbackTone };

function describeMovement(event: MovementEvent, coverage?: CoverageResult): FieldFeedback {
  if (event.validationStatus === 'REJECTED_DUPLICATE') return { title: 'Location already recorded', detail: 'Nothing was added twice. Keep moving before confirming your progress again.', tone: 'info' };
  if (event.validationStatus === 'REJECTED_ACCURACY') return { title: 'Location not used', detail: 'The GPS signal was too weak. Move into a clearer area and try again.', tone: 'danger' };
  if (event.validationStatus === 'REJECTED_SPEED') return { title: 'Location not used', detail: 'The movement was too fast to count as walking evidence.', tone: 'danger' };
  if (event.validationStatus !== 'ACCEPTED') return { title: 'Location not used', detail: event.validationReason ?? 'This location could not support street coverage.', tone: 'danger' };

  const outcome = coverage?.matchOutcome ?? event.mapMatchStatus;
  if (outcome === 'MATCHED') return { title: 'Street progress confirmed', detail: 'This walked section was matched to the project street and added to shared coverage.', tone: 'success' };
  if (outcome === 'AWAITING_NEXT_POINT') return { title: 'Location saved', detail: 'Keep walking, then confirm your progress again so the street section can be matched.', tone: 'info' };
  if (outcome === 'AMBIGUOUS') return { title: 'Street not confirmed yet', detail: 'Nearby streets are too close to distinguish safely. Keep walking on the intended street and try again.', tone: 'warning' };
  if (outcome === 'NO_MATCH') return { title: 'Street not confirmed', detail: 'The location was saved, but it did not match an assigned project street. Continue on the assigned street and try again.', tone: 'warning' };
  if (outcome === 'SKIPPED_UNSUPPORTED_TRAVERSAL') {
    const detail = coverage?.reason?.includes('chronological')
      ? 'Too much time passed since the previous location. Keep walking and confirm again within 10 minutes.'
      : 'The location was saved, but more continuous walking evidence is needed before a street can be counted.';
    return { title: 'Location saved — more movement needed', detail, tone: 'warning' };
  }
  if (outcome === 'RETRY_REQUIRED') return { title: 'Location saved — retry needed', detail: 'The server could not finish matching this point. Keep it queued and try syncing again.', tone: 'danger' };
  return { title: 'Location saved', detail: 'Your progress is stored and awaiting street confirmation.', tone: 'info' };
}

function feedbackIcon(tone: FeedbackTone): string {
  if (tone === 'success') return '✓';
  if (tone === 'danger') return '!';
  if (tone === 'warning') return '•';
  return 'i';
}

export default function AuthorisedSearchSession() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [movement, setMovement] = useState<MovementEvent[]>([]);
  const [evidence, setEvidence] = useState<EvidenceSummary | null>(null);
  const [coverageRefresh, setCoverageRefresh] = useState(0);
  const [feedback, setFeedback] = useState<FieldFeedback | null>(null);

  async function callSession(path = '') {
    if (!sessionId) throw new Error('Open this map from an authorised Field Today assignment.');
    const token = await getFieldToken();
    const response = await fetch(`${fieldApiOrigin()}/api/v1/search-sessions/${encodeURIComponent(sessionId)}${path}`, { method: path ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json() as { searchSession?: Session; message?: string };
    if (!response.ok || !body.searchSession) throw new Error(body.message ?? 'Store Coverage Search session unavailable.');
    return body.searchSession;
  }

  async function loadMovement() {
    if (!sessionId) return;
    const token = await getFieldToken();
    const response = await fetch(`${fieldApiOrigin()}/api/v1/search-sessions/${encodeURIComponent(sessionId)}/movement-events`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json() as { movementEvents?: MovementEvent[]; evidence?: EvidenceSummary; message?: string };
    if (!response.ok) throw new Error(body.message ?? 'Movement evidence unavailable.');
    setMovement(body.movementEvents ?? []);
    setEvidence(body.evidence ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const loaded = await callSession();
        if (!cancelled) {
          setSession(loaded);
          await loadMovement();
        }
      } catch (cause) {
        if (!cancelled) setMessage(cause instanceof Error ? cause.message : 'Store Coverage Search session unavailable.');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sessionId]);

  async function startSearch() {
    setBusy(true);
    setMessage(null);
    try {
      setSession(await callSession('/start'));
      setFeedback({ title: 'Search started', detail: 'Walk the assigned streets and confirm your progress as you go.', tone: 'success' });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Store Coverage Search could not be started.');
    } finally {
      setBusy(false);
    }
  }

  async function recordLocation() {
    if (!sessionId || !navigator.geolocation) {
      setMessage('Foreground location is not available in this browser.');
      return;
    }
    setBusy(true);
    setMessage('Requesting current foreground location…');
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const token = await getFieldToken();
        const response = await fetch(`${fieldApiOrigin()}/api/v1/search-sessions/${encodeURIComponent(sessionId)}/movement-events`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ capturedAt: new Date(position.timestamp).toISOString(), latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMetres: position.coords.accuracy, source: 'pwa_foreground' }),
        });
        const body = await response.json() as { movementEvent?: MovementEvent; coverage?: CoverageResult; message?: string };
        if (!response.ok || !body.movementEvent) throw new Error(body.message ?? 'Movement evidence could not be recorded.');
        setMessage(null);
        setFeedback(describeMovement(body.movementEvent, body.coverage));
        await loadMovement();
        setSession(await callSession());
        setCoverageRefresh((value) => value + 1);
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : 'Movement evidence could not be recorded.');
      } finally {
        setBusy(false);
      }
    }, (error) => {
      setMessage(error.message || 'Current location could not be read.');
      setBusy(false);
    }, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 });
  }

  if (!session) return <section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>{message ?? 'Loading authorised session…'}</strong></div></section>;
  const active = session.state === 'ACTIVE_SEARCH';
  const latest = movement[0];
  const traversal = evidence?.traversal;
  const visibleFeedback = feedback ?? (latest ? describeMovement(latest) : null);

  return <>
    <section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>{session.areaName ?? 'Assigned area'} · {session.state ?? 'READY'}</strong></div><div><span>Coverage state</span><strong>{session.coverageState ?? 'UNCOVERED'}</strong></div><div><span>Evidence queue</span><strong>{session.queuedEvidenceCount ?? 0} records</strong></div></section>
    <section className={s.summary}><div><strong>{session.unknownKm ?? 0} km</strong><span>Unknown · persisted</span></div><div><strong>{session.partialKm ?? 0} km</strong><span>Partial · persisted</span></div><div><strong>{session.searchedKm ?? 0} km</strong><span>Searched · persisted</span></div></section>
    {session.projectId ? <SharedStreetCoverageMap projectId={session.projectId} refreshKey={coverageRefresh} /> : null}
    <section className={s.action}>
      <p className={s.eyebrow}>Authorised field state</p>
      <h2>{active ? 'Store Coverage Search active' : 'Ready for Store Coverage Search'}</h2>
      <p>{active ? 'Walk the assigned streets and confirm your progress as you go. Confirmed street coverage is shared with the whole project team.' : 'Start when you are ready to walk the assigned area.'}</p>
      <div className={s.actionRow}><button className={s.secondary} type="button" onClick={startSearch} disabled={busy || active}>{active ? 'Search active' : busy ? 'Starting…' : 'Start Store Coverage Search'}</button><button className={s.primary} type="button" onClick={recordLocation} disabled={busy || !active}>{busy && active ? 'Checking location…' : 'Confirm my progress'}</button></div>
      {message ? <p className={s.subtle}>{message}</p> : null}
      {visibleFeedback ? <div className={`${feedbackStyles.captureFeedback} ${feedbackStyles[visibleFeedback.tone]}`} role="status"><span>{feedbackIcon(visibleFeedback.tone)}</span><div><strong>{visibleFeedback.title}</strong><p>{visibleFeedback.detail}</p></div></div> : null}
      {(evidence || traversal) ? <details className={feedbackStyles.technical}><summary>Technical evidence details</summary>{evidence ? <p>Evidence quality: {evidence.acceptedCount} accepted · {evidence.rejectedCount} excluded.</p> : null}{traversal ? <p>Candidate traversal: {traversal.supportedTraversalKm.toFixed(3)} km across {traversal.supportedSegmentCount} supported segment{traversal.supportedSegmentCount === 1 ? '' : 's'} · {traversal.derivationStatus.replaceAll('_', ' ').toLowerCase()}.</p> : null}</details> : null}
    </section>
    {movement.length ? <section className={s.action} aria-label="Recent field progress"><div className={feedbackStyles.activityHeader}><div><p className={s.eyebrow}>Recent progress</p><h2>What the app recorded</h2></div><span>Latest {Math.min(movement.length, 5)}</span></div><div className={feedbackStyles.tableWrap}><table className={feedbackStyles.activityTable}><thead><tr><th>Time</th><th>Result</th><th>What this means</th></tr></thead><tbody>{movement.slice(0, 5).map((event) => { const result = describeMovement(event); return <tr key={event.id}><td>{new Date(event.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td><span className={`${feedbackStyles.resultPill} ${feedbackStyles[result.tone]}`}>{result.title}</span></td><td>{result.detail}</td></tr>; })}</tbody></table></div></section> : null}
  </>;
}
