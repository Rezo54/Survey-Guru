'use client';

import { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { createGoogleAuthProvider, getFirebaseClientAuth } from '../../../lib/firebase-client';

type ApiResult = {
  status: number;
  body: unknown;
};

export default function DevAuthPage() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Not signed in.');

  async function verifyIdentity() {
    setBusy(true);
    setResult(null);

    try {
      const auth = getFirebaseClientAuth();
      if (!auth) throw new Error('Firebase web configuration is missing.');

      const credential = await signInWithPopup(auth, createGoogleAuthProvider());
      const token = await credential.user.getIdToken();
      setMessage(`Signed in as ${credential.user.email ?? credential.user.uid}`);

      const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
      const response = await fetch(`${apiOrigin}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const body: unknown = await response.json();
      setResult({ status: response.status, body });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication test failed.');
    } finally {
      setBusy(false);
    }
  }

  async function clearSession() {
    const auth = getFirebaseClientAuth();
    if (auth) await signOut(auth);
    setResult(null);
    setMessage('Signed out.');
  }

  return (
    <main style={{ maxWidth: 860, margin: '48px auto', padding: '0 24px', fontFamily: 'system-ui' }}>
      <p style={{ letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65 }}>Survey Guru DEV · identity checkpoint</p>
      <h1>Firebase authentication → Survey Guru API</h1>
      <p>This development-only screen proves identity transport. A successful Google sign-in must not itself grant workspace, project or business-data authority.</p>

      <div style={{ display: 'flex', gap: 12, margin: '24px 0' }}>
        <button type="button" onClick={verifyIdentity} disabled={busy}>{busy ? 'Checking…' : 'Sign in with Google & verify API'}</button>
        <button type="button" onClick={clearSession} disabled={busy}>Sign out</button>
      </div>

      <p><strong>Session:</strong> {message}</p>

      {result ? (
        <section>
          <h2>API response · HTTP {result.status}</h2>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 16, border: '1px solid #3a4b49', borderRadius: 12 }}>
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
