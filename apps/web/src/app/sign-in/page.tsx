'use client';
import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../lib/firebase-client';
import { api } from '../../lib/api';
import PublicNav from '../../components/PublicNav';
import s from '../public.module.css';
export default function SignInPage() {
  const [signup,setSignup] = useState(false); const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const auth = getFirebaseClientAuth(); if (!auth) throw new Error('Sign-in is not configured yet. Contact your administrator.');
      if (signup) { const result = await createUserWithEmailAndPassword(auth,email,password); await sendEmailVerification(result.user); await signOut(auth); setMessage('Account created. Verify your email, then ask your administrator to activate your role.'); setSignup(false); setPassword(''); }
      else { await signInWithEmailAndPassword(auth,email,password); const me = await api<{ authority:{ permissions:string[] } }>('/me'); try { window.localStorage.setItem('survey-guru:theme','dark'); } catch {} document.documentElement.dataset.theme='dark'; const p = me.authority.permissions; window.location.assign(p.includes('report.read') ? '/dashboard' : p.includes('qa.review') ? '/qa' : '/field'); }
    } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function reset() { setBusy(true); try { const auth = getFirebaseClientAuth(); if (!auth) throw new Error('Sign-in is not configured.'); await sendPasswordResetEmail(auth,email); setMessage('If this account is eligible, a password reset email will arrive shortly.'); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }
  return <main className={s.page}><div className={s.wrap}><PublicNav/><form className={`${s.form} ${s.card}`} onSubmit={submit}><p className={s.eyebrow}>Your field workspace</p><h1>{signup ? 'Request an account' : 'Welcome back.'}</h1><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={signup ? 10 : 1} required value={password} onChange={e => setPassword(e.target.value)}/></label>{signup && <p>Your administrator assigns your role and project access after registration.</p>}<button className={s.button} disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button><button className={s.secondary} type="button" onClick={() => {setSignup(!signup);setMessage('');}} disabled={busy}>{signup ? 'Already registered? Sign in' : 'New here? Request an account'}</button>{!signup && <button className={s.secondary} type="button" disabled={busy || !email} onClick={() => void reset()}>Reset password</button>}{message && <p role="status">{message}</p>}</form></div></main>;
}
