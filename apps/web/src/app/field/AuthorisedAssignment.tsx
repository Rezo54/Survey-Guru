'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../lib/firebase-client';
import styles from './field-today.module.css';

type Assignment = {
  id: string;
  areaName?: string;
  assignmentType?: string;
  teamName?: string;
  evidenceState?: string;
  targetState?: string;
  outstandingKm?: number;
};

type AssignmentResponse = {
  assignments?: Assignment[];
  error?: string;
  message?: string;
};

function waitForFirebaseUser(): Promise<User | null> {
  const auth = getFirebaseClientAuth();
  if (!auth) return Promise.resolve(null);
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export default function AuthorisedAssignment() {
  const [result, setResult] = useState<AssignmentResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const user = await waitForFirebaseUser();
        if (!user) {
          if (!cancelled) setResult({ error: 'not_signed_in', message: 'Sign in required for live assignment data.' });
          return;
        }
        const token = await user.getIdToken();
        const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
        const response = await fetch(`${apiOrigin}/api/v1/projects/prj_soweto_retail_universe/assignments/today`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json() as AssignmentResponse;
        if (!cancelled) setResult(body);
      } catch (error) {
        if (!cancelled) setResult({ error: 'request_failed', message: error instanceof Error ? error.message : 'Request failed.' });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const assignment = result?.assignments?.[0];
  if (!result) return <section className={styles.hero}><div><p className={styles.eyebrow}>Today&apos;s priority</p><h2>Loading authorised assignment…</h2></div></section>;
  if (!assignment) return <section className={styles.hero}><div><p className={styles.eyebrow}>Field access</p><h2>No active assignment</h2><p>{result.message ?? 'No identity-scoped Field Today assignment is available.'}</p></div></section>;

  return <section className={styles.hero}><div><p className={styles.eyebrow}>Today&apos;s priority · {assignment.evidenceState ?? 'Unknown'} geography</p><h2>{assignment.areaName ?? 'Assigned area'}</h2><p>Close the assigned search gap before moving to outlet verification. Unknown streets stay visible until search evidence exists.</p><div className={styles.heroTags}><span>{assignment.assignmentType ?? 'Field assignment'}</span><span>{assignment.teamName ?? 'Assigned team'}</span><span>API authorised</span></div></div><div className={styles.heroStat}><strong>{assignment.outstandingKm ?? '—'}</strong><span>km remaining</span></div><Link className={styles.heroAction} href="/field/map">Start / resume field map →</Link></section>;
}
