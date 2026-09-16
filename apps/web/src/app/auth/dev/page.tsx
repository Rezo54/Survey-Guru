'use client';

import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { createGoogleAuthProvider, getFirebaseClientAuth } from '../../../lib/firebase-client';

type ApiResult = {
  status: number;
  body: unknown;
};

export default function DevAuthPage() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Not signed in.');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function verifyApiIdentity(user: User) {
    const token = await user.getIdToken();
    setMessage(`Signed in as ${user.email ?? user.uid}`);
    const apiOrigin = process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
    const response = await fetch(`${apiOrigin}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body: unknown = await response.json();
    setResult({ status: response.status, body });
  }

  async function verifyGoogleIdentity() {
    setBusy(true);
    setResult(null);
    try {
      const auth = getFirebaseClientAuth();
      if (!auth) throw new Error('Firebase web configuration is missing.');
      const credential = await signInWithPopup(auth, createGoogleAuthProvider());
      await verifyApiIdentity(credential.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication test failed.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmailIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const auth = getFirebaseClientAuth();
      if (!auth) throw new Error('Firebase web configuration is missing.');
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await verifyApiIdentity(credential.user);
      setPassword('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Email sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function clearSession() {
    const auth = getFirebaseClientAuth();
    if (auth) await signOut(auth);
    setResult(null);
    setPassword('');
    setMessage('Signed out.');
  }

  return (
    <main style={{ maxWidth: 860, margin: '48px auto', padding: '0 24px', fontFamily: 'system-ui' }}>
      <p style={{ letterSpacing: '.12em', textTransform: 'uppercase', opacity: .65 }}>Survey Guru DEV · identity checkpoint</p>
      <h1>Firebase authentication → Survey Guru API</h1>
      <p>This development-only screen proves identity transport. A successful Firebase sign-in must not itself grant workspace, project or business-data authority.</p>

      <form onSubmit={verifyEmailIdentity} style={{ display: 'grid', gap: 12, maxWidth: 460, margin: '24px 0', padding: 18, border: '1px solid #3a4b49', borderRadius: 12 }}>
        <strong>DEV email and password</strong>
        <label style={{ display: 'grid', gap: 5 }}>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required disabled={busy} style={{ padding: 10 }} /></label>
        <label style={{ display: 'grid', gap: 5 }}>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={busy} style={{ padding: 10 }} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Sign in with email & verify API'}</button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '24px 0' }}>
        <button type="button" onClick={verifyGoogleIdentity} disabled={busy}>Sign in with Google & verify API</button>
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
