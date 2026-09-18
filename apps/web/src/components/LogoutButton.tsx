'use client';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { getFirebaseClientAuth } from '../lib/firebase-client';
import { nativeTrackingAvailable, stopNativeTracking } from '../lib/native-tracking';
export default function LogoutButton(){
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function logout(){setBusy(true);setError('');try{
    if(nativeTrackingAvailable())await stopNativeTracking();
    const auth=getFirebaseClientAuth();if(auth)await signOut(auth);
    window.location.replace('/sign-in');
  }catch(e){setError((e as Error).message);setBusy(false);}}
  return <div style={{position:'relative',zIndex:1,padding:'12px 16px'}}><button type="button" disabled={busy} onClick={()=>void logout()} style={{padding:'12px 20px',border:'1px solid var(--sg-border)',borderRadius:10,background:'var(--sg-surface)',color:'var(--sg-text)',cursor:'pointer',whiteSpace:'nowrap'}}>{busy?'Logging out…':'Log out'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
