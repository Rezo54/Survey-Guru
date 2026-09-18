'use client';
import { useEffect, useState } from 'react';
import { subscribeNativeTracking, stopNativeTracking } from '../lib/native-tracking';
export default function NativeTrackingBanner() {
  const [state, setState] = useState({ active: false, message: '', pending: 0 });
  useEffect(() => subscribeNativeTracking(setState), []);
  if (!state.active && !state.message) return null;
  return <aside role="status" style={{ position:'sticky', top:0, zIndex:10000, padding:'14px 20px', background:'var(--sg-surface-success,#123e36)', color:'var(--sg-text,#e7f3ee)' }}>{state.message} · {state.pending} pending {state.active && <button type="button" onClick={() => void stopNativeTracking().catch(() => {})}>Stop tracking</button>}</aside>;
}
