'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../lib/firebase-client';
import styles from './field-today.module.css';

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

export default function SearchSessionLauncher({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOrResume() {
    setBusy(true);
    setError(null);
    try {
      const user = await waitForFirebaseUser();
      if (!user) throw new Error('Sign in required before starting field capture.');
      const token = await user.getIdToken();
      const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
      const response = await fetch(`${apiOrigin}/api/v1/assignments/${encodeURIComponent(assignmentId)}/search-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json() as { searchSession?: { id?: string }; message?: string };
      if (!response.ok || !body.searchSession?.id) throw new Error(body.message ?? 'Search session could not be started.');
      router.push(`/field/map?session=${encodeURIComponent(body.searchSession.id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search session could not be started.');
    } finally {
      setBusy(false);
    }
  }

  return <div><button type="button" className={styles.heroAction} onClick={startOrResume} disabled={busy}>{busy ? 'Authorising field session…' : 'Start / resume field map →'}</button>{error ? <small>{error}</small> : null}</div>;
}
