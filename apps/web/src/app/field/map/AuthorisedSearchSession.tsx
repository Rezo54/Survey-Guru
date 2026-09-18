'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { nativeTrackingAvailable, startNativeTracking } from '../../../lib/native-tracking';
import { createForegroundTracker, type TrackingState } from './foreground-tracker';
import { useSearchParams } from 'next/navigation';
import { createMovementQueue, indexedMovementStore, SyncError } from './movement-queue';
import { fieldApiOrigin, getFieldToken, getFieldUserId } from './field-api';
import feedbackStyles from './FieldFeedback.module.css';
import SharedStreetCoverageMap from './SharedStreetCoverageMap';
import s from './field-map.module.css';

type Session = { id: string; projectId?: string; assignmentId?: string; areaName?: string; state?: string; coverageState?: string; searchedKm?: number; partialKm?: number; unknownKm?: number; queuedEvidenceCount?: number };
type MovementEvent = { id: string; capturedAt: string; accuracyMetres: number; source: string; validationStatus: string; validationReason?: string; mapMatchStatus?: string };
type TraversalSummary = { acceptedPointCount: number; segmentCount: number; supportedSegmentCount: number; supportedTraversalKm: number; derivationStatus: string; coverageDerived: boolean; coverageReason: string };
type EvidenceSummary = { count: number; acceptedCount: number; rejectedCount: number; coverageState: string; searchedKm: number; traversal: TraversalSummary };
type CoverageResult = { changed?: boolean; matchOutcome?: string; persistence?: string; reason?: string };
type FeedbackTone = 'success' | 'info' | 'warning' | 'danger';
type FieldFeedback = { title: string; detail: string; tone: FeedbackTone };

function describeMovement(event: MovementEvent, coverage?: CoverageResult): FieldFeedback {
  if (event.validationStatus === 'REJECTED_DUPLICATE') return { title: 'Location already recorded', detail: 'No additional movement was counted. Keep walking with tracking active.', tone: 'info' };
  if (event.validationStatus === 'REJECTED_ACCURACY') return { title: 'Location not used', detail: 'The GPS signal was too weak. Move into a clearer area and try again.', tone: 'danger' };
  if (event.validationStatus === 'REJECTED_SPEED') return { title: 'Location not used', detail: 'The movement was too fast to count as walking evidence.', tone: 'danger' };
  if (event.validationStatus !== 'ACCEPTED') return { title: 'Location not used', detail: event.validationReason ?? 'This location could not support street coverage.', tone: 'danger' };

  const outcome = coverage?.matchOutcome ?? event.mapMatchStatus;
  if (outcome === 'MATCHED') return { title: 'Street progress confirmed', detail: 'This walked section was matched to the project street and added to shared coverage.', tone: 'success' };
  if (outcome === 'AWAITING_NEXT_POINT') return { title: 'Location saved', detail: 'Keep walking with tracking active so the street section can be matched.', tone: 'info' };
  if (outcome === 'AMBIGUOUS') return { title: 'Street not confirmed yet', detail: 'Nearby streets are too close to distinguish safely. Keep walking on the intended street and try again.', tone: 'warning' };
  if (outcome === 'NO_MATCH') return { title: 'Street not confirmed', detail: 'The location was saved, but it did not match an assigned project street. Continue on the assigned street and try again.', tone: 'warning' };
  if (outcome === 'SKIPPED_UNSUPPORTED_TRAVERSAL') {
    const detail = coverage?.reason?.includes('chronological')
      ? 'Too much time passed since the previous location. Keep walking and confirm again within 10 minutes.'
      : 'The location was saved, but more continuous walking evidence is needed before a street can be counted.';
    return { title: 'Location saved — more movement needed', detail, tone: 'warning' };
  }
  if (outcome === 'RETRY_REQUIRED') return { title: 'Location saved — review needed', detail: 'The server could not finish matching this point. Street coverage is not confirmed for this location.', tone: 'danger' };
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

  const tracker = useRef<ReturnType<typeof createForegroundTracker> | null>(null);
  const resumeRequested = useRef(false);
  const [pendingLocations, setPendingLocations] = useState(0);
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(nativeTrackingAvailable()); }, []);
  const [syncMessage, setSyncMessage] = useState('');
  const [tracking, setTracking] = useState<TrackingState>('idle');
  const [trackingMessage, setTrackingMessage] = useState('Start tracking to record progress while this page is visible.');

  async function callSession(path = '', signal?: AbortSignal) {
    if (!sessionId) throw new Error('Open this map from an authorised Field Today assignment.');
    const token = await getFieldToken();
    const response = await fetch(`${fieldApiOrigin()}/api/v1/search-sessions/${encodeURIComponent(sessionId)}${path}`, { method: path ? 'POST' : 'GET', signal: signal ?? null, headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json() as { searchSession?: Session; message?: string };
    if (!response.ok || !body.searchSession) throw new Error(body.message ?? 'Store Coverage Search session unavailable.');
    return body.searchSession;
  }

  async function loadMovement(signal?: AbortSignal) {
    if (!sessionId) return;
    const token = await getFieldToken();
    const response = await fetch(`${fieldApiOrigin()}/api/v1/search-sessions/${encodeURIComponent(sessionId)}/movement-events`, { signal: signal ?? null, headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json() as { movementEvents?: MovementEvent[]; evidence?: EvidenceSummary; message?: string };
    if (!response.ok) throw new Error(body.message ?? 'Movement evidence unavailable.');
    if (signal?.aborted) return;
    setMovement(body.movementEvents ?? []);
    setEvidence(body.evidence ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    const request = new AbortController();
    setSession(null);
    setMovement([]);
    setEvidence(null);
    setFeedback(null);
    setMessage(null);
    async function load() {
      try {
        const loaded = await callSession('', request.signal);
        if (!cancelled) {
          setSession(loaded);
          await loadMovement(request.signal);
        }
      } catch (cause) {
        if (!cancelled) setMessage(cause instanceof Error ? cause.message : 'Store Coverage Search session unavailable.');
      }
    }
    void load();
    return () => { cancelled = true; request.abort(); };
  }, [sessionId]);

  async function startSearch(resumeTracking = false) {
    setBusy(true);
    setMessage(null);
    try {
      const started = await callSession('/start');
      resumeRequested.current = resumeTracking;
      setSession(started);
      if (native && resumeTracking) { resumeRequested.current = false; await startNativeTracking(started.id); }
      setFeedback({ title: 'Search started', detail: 'Start foreground tracking, then walk the assigned streets with this page visible.', tone: 'success' });
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Store Coverage Search could not be started.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setTracking('idle');
    setTrackingMessage('Start tracking to record progress while this page is visible.');
    if (!sessionId || session?.id !== sessionId || session.state !== 'ACTIVE_SEARCH' || native) return;
    if (!navigator.geolocation) {
      setTrackingMessage('Foreground location is not available in this browser.');
      return;
    }
    let cancelled = false;
    let dispose = () => {};
    void getFieldUserId().then((ownerId) => {
      if (cancelled) return;
      const queue = createMovementQueue({
        store: indexedMovementStore(), ownerId, sessionId,
        currentOwner: getFieldUserId, online: () => navigator.onLine,
        onStatus: (count, detail) => { if (!cancelled) { setPendingLocations(count); setSyncMessage(detail); } },
        send: async (point, signal) => {
          const token = await getFieldToken();
          if (signal.aborted) throw new Error('Sync paused.');
          const response = await fetch(fieldApiOrigin() + '/api/v1/search-sessions/' + encodeURIComponent(sessionId) + '/movement-events', {
            method: 'POST', signal, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(point),
          });
          const body = await response.json() as { movementEvent?: MovementEvent; coverage?: CoverageResult; message?: string };
          if (!response.ok || !body.movementEvent) throw new SyncError(body.message ?? 'Location sync could not finish.', response.status);
          if (cancelled) return;
          setFeedback(describeMovement(body.movementEvent, body.coverage));
          setMovement(previous => [body.movementEvent!, ...previous.filter(e => e.id !== body.movementEvent!.id)].slice(0, 25));
          setCoverageRefresh(value => value + 1);
          // A failed status refresh must not turn an acknowledged upload into a failure.
          void loadMovement(signal).catch(() => {});
        },
      });
      const controller = createForegroundTracker({
        geolocation: navigator.geolocation,
        isAvailable: () => document.visibilityState === 'visible',
        onState: (state, detail) => { if (!cancelled) { setTracking(state); setTrackingMessage(detail); } },
        submit: position => queue.enqueue(position),
      });
      tracker.current = controller;
      if (resumeRequested.current) { resumeRequested.current = false; controller.start(); }
      const hide = () => { if (document.visibilityState !== 'visible') controller.stop('Tracking paused while this page was hidden. Resume when ready.'); else void queue.flush(); };
      const sync = () => { void queue.flush(); };
      const leave = () => controller.stop();
      const interval = window.setInterval(sync, 15000);
      document.addEventListener('visibilitychange', hide);
      window.addEventListener('online', sync);
      window.addEventListener('offline', sync);
      window.addEventListener('pagehide', leave);
      sync();
      dispose = () => {
        controller.stop(); queue.dispose(); window.clearInterval(interval); tracker.current = null;
        document.removeEventListener('visibilitychange', hide);
        window.removeEventListener('online', sync); window.removeEventListener('offline', sync); window.removeEventListener('pagehide', leave);
      };
    }).catch(error => { if (!cancelled) setTrackingMessage(error instanceof Error ? error.message : 'Sign in required.'); });
    return () => { cancelled = true; dispose(); };
  }, [sessionId, session?.id, session?.state, native]);

  if (!session) return <section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>{message ?? 'Loading authorised session…'}</strong></div></section>;
  const active = session.state === 'ACTIVE_SEARCH';
  const latest = movement[0];
  const traversal = evidence?.traversal;
  const visibleFeedback = feedback ?? (latest ? describeMovement(latest) : null);

  return <>
    <section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>{session.areaName ?? 'Assigned area'} · {session.state ?? 'READY'}</strong></div><div><span>Coverage state</span><strong>{session.coverageState ?? 'UNCOVERED'}</strong></div><div><span>Evidence queue</span><strong>{session.queuedEvidenceCount ?? 0} records</strong></div></section>
    <section className={s.summary}><div><strong>{session.unknownKm ?? 0} km</strong><span>Unknown · persisted</span></div><div><strong>{session.partialKm ?? 0} km</strong><span>Partial · persisted</span></div><div><strong>{session.searchedKm ?? 0} km</strong><span>Searched · persisted</span></div></section>
    {session.projectId ? <SharedStreetCoverageMap projectId={session.projectId} refreshKey={coverageRefresh} {...(session.assignmentId ? { captureHref: `/field/stores/new?assignment=${encodeURIComponent(session.assignmentId)}&session=${encodeURIComponent(session.id)}` } : {})} /> : null}
    <section className={s.action} id="search-controls">
      <p className={s.eyebrow}>Authorised field state</p>
      <h2>{active ? 'Store Coverage Search active' : 'Ready for Store Coverage Search'}</h2>
      <p>{active ? native ? 'The installed app records in the background. Use the tracking banner to stop. Confirmed street coverage is shared with the project team.' : 'Keep this page visible and your screen unlocked while tracking. Confirmed street coverage is shared with the project team.' : 'Start when you are ready to walk the assigned area.'}</p>
      <div className={s.actionRow}><button className={s.secondary} type="button" onClick={() => void startSearch()} disabled={busy || active}>{active ? 'Search active' : busy ? 'Starting…' : 'Start Store Coverage Search'}</button><button className={s.primary} type="button" onClick={() => native ? void startNativeTracking(session.id).catch(e => setMessage(e.message)) : tracking === 'tracking' ? tracker.current?.stop() : tracker.current?.start()} disabled={busy || !active || session.id !== sessionId}>{native ? 'Start background tracking' : tracking === 'tracking' ? 'Stop tracking' : 'Start foreground tracking'}</button>{session.assignmentId ? <Link className={s.secondary} href={`/field/stores/new?assignment=${encodeURIComponent(session.assignmentId)}&session=${encodeURIComponent(session.id)}`}>Capture a store</Link> : null}</div>
      {!native && <><p role="status" aria-live="polite">{trackingMessage}</p><p role="status">{pendingLocations} locations awaiting sync · {syncMessage}</p></>}
      <p className={s.subtle}>GPS points are saved on this device during connection loss and sync automatically. Keep this browser page visible and the screen unlocked. Sync within seven days; do not clear browser storage with pending locations.</p>
      {message ? <p className={s.subtle}>{message}</p> : null}
      {visibleFeedback ? <div className={`${feedbackStyles.captureFeedback} ${feedbackStyles[visibleFeedback.tone]}`} role="status"><span>{feedbackIcon(visibleFeedback.tone)}</span><div><strong>{visibleFeedback.title}</strong><p>{visibleFeedback.detail}</p></div></div> : null}
      {(evidence || traversal) ? <details className={feedbackStyles.technical}><summary>Technical evidence details</summary>{evidence ? <p>Evidence quality: {evidence.acceptedCount} accepted · {evidence.rejectedCount} excluded.</p> : null}{traversal ? <p>Candidate traversal: {traversal.supportedTraversalKm.toFixed(3)} km across {traversal.supportedSegmentCount} supported segment{traversal.supportedSegmentCount === 1 ? '' : 's'} · {traversal.derivationStatus.replaceAll('_', ' ').toLowerCase()}.</p> : null}</details> : null}
    </section>
    <section className={s.action}><p className={s.eyebrow}>Next best action · Coverage evidence</p><h2>Search the assigned geography</h2><p>Resume foreground tracking after a store visit. Keep this page visible and the screen unlocked while you walk.</p><div className={s.actionRow}><button className={s.primary} type="button" onClick={() => active ? native ? void startNativeTracking(session.id).catch(e => setMessage(e.message)) : tracker.current?.start() : void startSearch(true)} disabled={busy || tracking === 'tracking' || session.id !== sessionId || !['READY', 'PAUSED', 'ACTIVE_SEARCH'].includes(session.state ?? '')}>{tracking === 'tracking' ? 'Search tracking active' : busy ? 'Resuming…' : 'Resume search'}</button><Link className={s.secondary} href="/field">Back to Today</Link></div></section>
    {movement.length ? <section className={s.action} aria-label="Recent field progress"><div className={feedbackStyles.activityHeader}><div><p className={s.eyebrow}>Recent progress</p><h2>What the app recorded</h2></div><span>Latest {Math.min(movement.length, 5)}</span></div><div className={feedbackStyles.tableWrap}><table className={feedbackStyles.activityTable}><thead><tr><th>Time</th><th>Result</th><th>What this means</th></tr></thead><tbody>{movement.slice(0, 5).map((event) => { const result = describeMovement(event); return <tr key={event.id}><td>{new Date(event.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td><span className={`${feedbackStyles.resultPill} ${feedbackStyles[result.tone]}`}>{result.title}</span></td><td>{result.detail}</td></tr>; })}</tbody></table></div></section> : null}
  </>;
}
