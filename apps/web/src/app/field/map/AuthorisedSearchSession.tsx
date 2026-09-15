'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../../lib/firebase-client';
import s from './field-map.module.css';

type Session = { id: string; areaName?: string; state?: string; coverageState?: string; searchedKm?: number; partialKm?: number; unknownKm?: number; queuedEvidenceCount?: number };

function waitForFirebaseUser(): Promise<User | null> {
  const auth = getFirebaseClientAuth(); if (!auth) return Promise.resolve(null); if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => { const unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user); }); });
}

export default function AuthorisedSearchSession() {
  const searchParams = useSearchParams(); const sessionId = searchParams.get('session');
  const [session, setSession] = useState<Session | null>(null); const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  async function callSession(path = '') {
    if (!sessionId) throw new Error('Open this map from an authorised Field Today assignment.');
    const user = await waitForFirebaseUser(); if (!user) throw new Error('Sign in required for field capture.');
    const token = await user.getIdToken(); const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
    const response = await fetch(`${apiOrigin}/api/v1/search-sessions/${encodeURIComponent(sessionId)}${path}`, { method: path ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json() as { searchSession?: Session; message?: string };
    if (!response.ok || !body.searchSession) throw new Error(body.message ?? 'Store Coverage Search session unavailable.');
    return body.searchSession;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() { try { const loaded = await callSession(); if (!cancelled) setSession(loaded); } catch (cause) { if (!cancelled) setMessage(cause instanceof Error ? cause.message : 'Store Coverage Search session unavailable.'); } }
    void load(); return () => { cancelled = true; };
  }, [sessionId]);

  async function startSearch() {
    setBusy(true); setMessage(null);
    try { setSession(await callSession('/start')); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Store Coverage Search could not be started.'); } finally { setBusy(false); }
  }

  if (!session) return <section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>{message ?? 'Loading authorised session…'}</strong></div></section>;
  const active = session.state === 'ACTIVE_SEARCH';
  return <><section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>{session.areaName ?? 'Assigned area'} · {session.state ?? 'READY'}</strong></div><div><span>Coverage state</span><strong>{session.coverageState ?? 'UNCOVERED'}</strong></div><div><span>Evidence queue</span><strong>{session.queuedEvidenceCount ?? 0} records</strong></div></section><section className={s.summary}><div><strong>{session.unknownKm ?? 0} km</strong><span>Unknown · persisted</span></div><div><strong>{session.partialKm ?? 0} km</strong><span>Partial · persisted</span></div><div><strong>{session.searchedKm ?? 0} km</strong><span>Searched · persisted</span></div></section><section className={s.action}><p className={s.eyebrow}>Authorised field state</p><h2>{active ? 'Store Coverage Search active' : 'Ready for Store Coverage Search'}</h2><p>{active ? 'Survey Guru is ready to record movement through the assigned area as Store Coverage evidence. Geography remains Unknown until sufficient movement evidence is captured and validated.' : 'Starting Store Coverage Search changes only the authorised session state. It does not manufacture coverage evidence.'}</p><div className={s.actionRow}><button className={s.primary} type="button" onClick={startSearch} disabled={busy || active}>{active ? 'Store Coverage Search active' : busy ? 'Starting…' : 'Start Store Coverage Search'}</button>{message ? <span className={s.secondary}>{message}</span> : null}</div></section></>;
}
