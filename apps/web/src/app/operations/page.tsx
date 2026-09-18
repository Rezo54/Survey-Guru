'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import SurveyGuruSidebar from '../../components/SurveyGuruSidebar';
import { api } from '../../lib/api';
import s from '../../components/Workspace.module.css';
type Area = { id: string; projectId: string; name: string; reviewState: string; reviewNote?: string; supervisorIds: string[] };
type Operations = { canManage: boolean; canReview: boolean; canSubmit: boolean; projects: { id: string; name: string }[]; areas: Area[];
  assignments: { id: string; areaId?: string; areaName: string; projectId: string; assignedUserId: string; status: string }[];
  people: { id: string; name: string; permissions: string[] }[] };
export default function OperationsPage() {
  const [data, setData] = useState<Operations | null>(null); const [message, setMessage] = useState('Loading authorised areas…');
  const [busy, setBusy] = useState(false); const [kind, setKind] = useState('field');
  async function load() { const next = await api<Operations>('/operations'); setData(next); setMessage(next.areas.length ? '' : 'No project areas have been assigned yet.'); }
  useEffect(() => { void load().catch(e => setMessage(e.message)); }, []);
  async function act(path: string, body: unknown) { setBusy(true); try { await api(path, body); await load(); setMessage('Change saved.'); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } }
  function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); void act('/operations/areas', { projectId: f.get('project'), name: f.get('name') }); }
  function assign(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); void act(`/operations/areas/${f.get('area')}/assign`, { userId: f.get('person'), kind }); }
  return <main className={s.page}><div className={s.shell}><SurveyGuruSidebar active="operations"/><section className={s.content}>
    <header className={s.header}><div><p className={s.eyebrow}>Field delivery · Supervision · QA</p><h1>Project areas</h1><p>Assign responsibility, monitor field work and submit areas for review.</p></div><Link href="/dashboard">Dashboard →</Link></header>
    {message && <p className={s.status} role="status">{message}</p>}
    {data?.canManage && <div className={s.grid}><form onSubmit={create} className={`${s.card} ${s.form}`}><h2>Create a work area</h2><label>Project<select name="project" required>{data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Area name<input name="name" required maxLength={120}/></label><p>Work areas currently use the selected project boundary. Create a separate bounded project for a distinct geographic area.</p><button disabled={busy || !data.projects.length}>Create area</button></form>
    <form onSubmit={assign} className={`${s.card} ${s.form}`}><h2>Assign responsibility</h2><label>Area<select name="area" required>{data.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Responsibility<select value={kind} onChange={e => setKind(e.target.value)}><option value="field">Field agent</option><option value="supervisor">Supervisor</option></select></label><label>Person<select name="person" required>{data.people.filter(p => p.permissions.includes(kind === 'field' ? 'field.capture' : 'supervisor.review')).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button disabled={busy || !data.areas.length}>Assign</button><Link href="/settings/roles">Manage people and roles →</Link></form></div>}
    <div className={s.grid}>{data?.areas.map(area => <article key={area.id} className={s.card}><p className={s.eyebrow}>{area.reviewState.replaceAll('_',' ')}</p><h2>{area.name}</h2><p>{data.projects.find(p => p.id === area.projectId)?.name}</p><p>{area.supervisorIds.length} assigned supervisor(s)</p><Link href={`/insights?project=${encodeURIComponent(area.projectId)}&area=${encodeURIComponent(area.id)}`}>View area insights →</Link><p>{area.reviewNote}</p>
      {data.assignments.filter(a => a.areaId === area.id).map(a => <div className={s.row} key={a.id}><span>{data.people.find(p => p.id === a.assignedUserId)?.name ?? a.assignedUserId}<small>{a.status}</small></span>{data.canManage && a.status === 'active' && <button disabled={busy} onClick={() => void act(`/operations/assignments/${a.id}/unassign`, {})}>Unassign</button>}</div>)}
      {(data.canSubmit || data.canReview) && <form className={s.form} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void act(`/operations/areas/${area.id}/review`, { decision: form.get('decision'), note: form.get('note') }); }}><label>Review note<textarea name="note" required maxLength={2000}/></label><label>Action<select name="decision">{data.canSubmit && <option value="SUBMIT">Send to QA</option>}{data.canReview && area.reviewState === 'SUBMITTED' && <><option value="ACCEPT">Accept area</option><option value="RETURN">Return to supervisor</option></>}</select></label><button disabled={busy || (!data.canSubmit && area.reviewState !== 'SUBMITTED')}>Record decision</button></form>}
    </article>)}</div>
    {data?.canManage && <section className={s.card}><h2>All agent assignments</h2>{data.assignments.filter(a => a.status === 'active').map(a => <div className={s.row} key={a.id}><span>{a.areaName}<small>{data.people.find(p => p.id === a.assignedUserId)?.name ?? a.assignedUserId}</small></span><button disabled={busy} onClick={() => void act(`/operations/assignments/${a.id}/unassign`, {})}>Unassign</button></div>)}</section>}
  </section></div></main>;
}
