'use client';

import { useState } from 'react';
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
  const [busy, setBusy] = useState(false);

  async function loadProjectSummary() {
    setBusy(true);
    try {
      const user = await waitForFirebaseUser();
      if (!user) {
        setResult({ error: 'not_signed_in', message: 'No persisted Firebase session was found. Sign in at /auth/dev first.' });
        return;
      }

      const token = await user.getIdToken();
      const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
      const response = await fetch(`${apiOrigin}/api/v1/projects/prj_soweto_retail_universe/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json() as ProjectSummary;
      setResult(body);
    } catch (error) {
      setResult({ error: 'request_failed', message: error instanceof Error ? error.message : 'Request failed.' });
    } finally {
      setBusy(false);
    }
  }

  const summary = result?.project?.summary;

  return (
    <div>
      <button type="button" onClick={loadProjectSummary} disabled={busy}>
        {busy ? 'Loading authorised project…' : 'Load authorised Soweto project'}
      </button>
      {result ? (
        <div style={{ marginTop: 12 }}>
          {result.project ? (
            <small>
              Firestore/API · {result.project.name} · {summary?.searchedPercent ?? '—'}% searched · {summary?.outstandingKm ?? '—'} km outstanding · {summary?.verifiedPriorityOutlets ?? '—'} verified outlets · project scope {result.authority?.projectScoped ? 'verified' : 'not verified'}
            </small>
          ) : (
            <small>{result.error}: {result.message}</small>
          )}
        </div>
      ) : null}
    </div>
  );
}
