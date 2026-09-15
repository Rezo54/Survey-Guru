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
  const [session, setSession] = useState<Session | null>(null); const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!sessionId) { setMessage('Open this map from an authorised Field Today assignment.'); return; }
      try {
        const user = await waitForFirebaseUser(); if (!user) throw new Error('Sign in required for field capture.');
        const token = await user.getIdToken(); const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
        const response = await fetch(`${apiOrigin}/api/v1/search-sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await response.json() as { searchSession?: Session; message?: string };
        if (!response.ok || !body.searchSession) throw new Error(body.message ?? 'Search session unavailable.');
        if (!cancelled) setSession(body.searchSession);
      } catch (cause) { if (!cancelled) setMessage(cause instanceof Error ? cause.message : 'Search session unavailable.'); }
    }
    void load(); return () => { cancelled = true; };
  }, [sessionId]);

  if (!session) return <section className={s.policy}><div><span>Persisted session</span><strong>{message ?? 'Loading authorised search session…'}</strong></div></section>;
  return <><section className={s.policy}><div><span>Persisted session</span><strong>{session.areaName ?? 'Assigned area'} · {session.state ?? 'READY'}</strong></div><div><span>Coverage state</span><strong>{session.coverageState ?? 'UNCOVERED'}</strong></div><div><span>Evidence queue</span><strong>{session.queuedEvidenceCount ?? 0} records</strong></div></section><section className={s.summary}><div><strong>{session.unknownKm ?? 0} km</strong><span>Unknown · persisted</span></div><div><strong>{session.partialKm ?? 0} km</strong><span>Partial · persisted</span></div><div><strong>{session.searchedKm ?? 0} km</strong><span>Searched · persisted</span></div></section></>;
}
