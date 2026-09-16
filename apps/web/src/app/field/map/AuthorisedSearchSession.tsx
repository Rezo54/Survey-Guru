'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fieldApiOrigin, getFieldToken } from './field-api';
import SharedStreetCoverageMap from './SharedStreetCoverageMap';
import s from './field-map.module.css';

type Session = { id: string; projectId?: string; areaName?: string; state?: string; coverageState?: string; searchedKm?: number; partialKm?: number; unknownKm?: number; queuedEvidenceCount?: number };
type MovementEvent = { id: string; capturedAt: string; accuracyMetres: number; source: string; validationStatus: string; validationReason?: string; mapMatchStatus?: string };
type TraversalSummary = { acceptedPointCount: number; segmentCount: number; supportedSegmentCount: number; supportedTraversalKm: number; derivationStatus: string; coverageDerived: boolean; coverageReason: string };
type EvidenceSummary = { count: number; acceptedCount: number; rejectedCount: number; coverageState: string; searchedKm: number; traversal: TraversalSummary };
type CoverageResult = { changed?: boolean; matchOutcome?: string; persistence?: string; reason?: string };

export default function AuthorisedSearchSession() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [movement, setMovement] = useState<MovementEvent[]>([]);
  const [evidence, setEvidence] = useState<EvidenceSummary | null>(null);
  const [coverageRefresh, setCoverageRefresh] = useState(0);

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
        const accepted = body.movementEvent.validationStatus === 'ACCEPTED';
        const outcome = body.coverage?.matchOutcome ?? body.movementEvent.mapMatchStatus;
        setMessage(accepted
          ? `Evidence accepted · accuracy ${Math.round(body.movementEvent.accuracyMetres)} m · ${outcome?.replaceAll('_', ' ').toLowerCase() ?? 'awaiting reconciliation'}. ${body.coverage?.reason ?? ''}`.trim()
          : `Evidence excluded · ${body.movementEvent.validationReason ?? body.movementEvent.validationStatus}.`);
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

  return <>
    <section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>{session.areaName ?? 'Assigned area'} · {session.state ?? 'READY'}</strong></div><div><span>Coverage state</span><strong>{session.coverageState ?? 'UNCOVERED'}</strong></div><div><span>Evidence queue</span><strong>{session.queuedEvidenceCount ?? 0} records</strong></div></section>
    <section className={s.summary}><div><strong>{session.unknownKm ?? 0} km</strong><span>Unknown · persisted</span></div><div><strong>{session.partialKm ?? 0} km</strong><span>Partial · persisted</span></div><div><strong>{session.searchedKm ?? 0} km</strong><span>Searched · persisted</span></div></section>
    {session.projectId ? <SharedStreetCoverageMap projectId={session.projectId} refreshKey={coverageRefresh} /> : null}
    <section className={s.action}>
      <p className={s.eyebrow}>Authorised field state</p>
      <h2>{active ? 'Store Coverage Search active' : 'Ready for Store Coverage Search'}</h2>
      <p>{active ? 'Capture foreground movement as evidence while this PWA is in use. The server reconciles accepted point pairs to eligible project streets and shares confirmed coverage with every authorised project user.' : 'Starting Store Coverage Search changes only the authorised session state. It does not manufacture coverage evidence.'}</p>
      <div className={s.actionRow}><button className={s.primary} type="button" onClick={startSearch} disabled={busy || active}>{active ? 'Store Coverage Search active' : busy ? 'Starting…' : 'Start Store Coverage Search'}</button><button className={s.secondary} type="button" onClick={recordLocation} disabled={busy || !active}>{busy && active ? 'Recording…' : 'Record current location'}</button></div>
      {message ? <p className={s.subtle}>{message}</p> : null}
      {evidence ? <p className={s.subtle}>Evidence quality: {evidence.acceptedCount} accepted · {evidence.rejectedCount} excluded.</p> : null}
      {traversal ? <p className={s.subtle}>Candidate traversal: {traversal.supportedTraversalKm.toFixed(3)} km across {traversal.supportedSegmentCount} supported segment{traversal.supportedSegmentCount === 1 ? '' : 's'} · {traversal.derivationStatus.replaceAll('_', ' ').toLowerCase()}. Street outcome is shown on the shared map.</p> : null}
      {latest ? <p className={s.subtle}>Latest evidence: {new Date(latest.capturedAt).toLocaleTimeString()} · ±{Math.round(latest.accuracyMetres)} m · {latest.validationStatus} · {latest.mapMatchStatus?.replaceAll('_', ' ').toLowerCase() ?? 'not reconciled'}.</p> : null}
    </section>
  </>;
}
