'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../lib/firebase-client';

type ProjectSummary = {
  project?: {
    id?: string;
    name?: string;
    status?: string;
    summary?: {
      searchedPercent?: number;
      outstandingKm?: number;
      verifiedPriorityOutlets?: number;
      networkDecision?: string;
    };
  };
  authority?: {
    permission?: string;
    workspaceId?: string;
    projectScoped?: boolean;
  };
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

export default function ProjectSummaryCheckpoint() {
  const [result, setResult] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjectSummary() {
      try {
        const user = await waitForFirebaseUser();
        if (!user) {
          if (!cancelled) setResult({ error: 'not_signed_in', message: 'Sign in required for live project data.' });
          return;
        }

        const token = await user.getIdToken();
        const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
        const response = await fetch(`${apiOrigin}/api/v1/projects/prj_soweto_retail_universe/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await response.json() as ProjectSummary;
        if (!cancelled) setResult(body);
      } catch (error) {
        if (!cancelled) {
          setResult({ error: 'request_failed', message: error instanceof Error ? error.message : 'Request failed.' });
        }
      }
    }

    void loadProjectSummary();
    return () => { cancelled = true; };
  }, []);

  const summary = result?.project?.summary;

  if (!result) return <small>Loading authorised project intelligence…</small>;
  if (!result.project) return <small>Live project data unavailable · {result.message ?? result.error}</small>;

  return (
    <small>
      Live Firestore/API · {summary?.searchedPercent ?? '—'}% searched · {summary?.outstandingKm ?? '—'} km outstanding · {summary?.verifiedPriorityOutlets ?? '—'} verified outlets · project scope {result.authority?.projectScoped ? 'verified' : 'not verified'}
    </small>
  );
}
