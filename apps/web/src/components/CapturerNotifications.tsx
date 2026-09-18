'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import s from './Workspace.module.css';
type Notice = { id: string; title: string; message: string; createdAt: string; type: string; storeCaptureId: string; assignmentId?: string; canCorrect: boolean };
export default function CapturerNotifications() {
  const [notices,setNotices] = useState<Notice[]>([]); const [error,setError] = useState('');
  useEffect(() => { let disposed=false; let pending=false;
    async function load() { if(pending)return;pending=true;try {const result=await api<{notifications:Notice[]}>('/me/notifications');if(!disposed){setNotices(result.notifications);setError('');}}catch(e){if(!disposed)setError((e as Error).message);}finally{pending=false;} }
    const refresh=()=>{if(document.visibilityState==='visible')void load();};void load();const timer=window.setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{disposed=true;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  if(!notices.length&&!error)return null;
  return <section className={s.card} aria-label="Messages from QA"><h2>Messages from QA</h2>{error&&<p role="status">Messages could not refresh: {error}</p>}{notices.map(n=><article key={n.id} className={s.row}><div><strong>{n.title}</strong><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()}</small>{n.type==='STORE_REDO_REQUIRED'&&!n.canCorrect&&<p>This review is resolved or your assignment is no longer active. Contact your supervisor if you still need access.</p>}</div>{n.canCorrect&&n.assignmentId&&<Link href={`/field/stores/new?assignment=${encodeURIComponent(n.assignmentId)}&capture=${encodeURIComponent(n.storeCaptureId)}`}>View details and correct store →</Link>}</article>)}</section>;
}
