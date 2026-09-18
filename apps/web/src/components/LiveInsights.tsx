'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import SurveyGuruSidebar from './SurveyGuruSidebar';
import ProjectCoverageMap from './ProjectCoverageMap';
import s from './Workspace.module.css';
type Insight = { project: { id: string; name: string; areaSquareKm: number | null }; areas: { id: string; name: string; reviewState: string }[];
  metrics: { submittedCustomers: number; acceptedCustomers: number; awaitingQa: number; activeAgents: number; submittedAreas: number };
  statusCounts: Record<string, number>; brandPerformance: { brand: string; stores: number }[];
  fieldActivity: { id: string; areaName: string; state: string; acceptedPoints: number; lastEvidenceAt: string | null }[]; generatedAt: string };
export default function LiveInsights({ dashboard = false }: { dashboard?: boolean }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]); const [project, setProject] = useState(''); const [area, setArea] = useState('');
  const [data, setData] = useState<Insight | null>(null); const [message, setMessage] = useState('Loading authorised projects…'); const [refresh, setRefresh] = useState(0);
  useEffect(() => { const controller = new AbortController(); void api<{ projects: { id: string; name: string }[] }>('/projects/active', undefined, controller.signal).then(r => {
    const query = new URLSearchParams(window.location.search); const chosen = r.projects.find(p => p.id === query.get('project')) ?? r.projects[0];
    setProjects(r.projects); setProject(chosen?.id ?? ''); setArea(query.get('area') ?? ''); if (!chosen) setMessage('No projects are available to your role.');
  }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); }); return () => controller.abort(); }, []);
  useEffect(() => { if (!project) return; const controller = new AbortController(); setData(null); setMessage('Loading selected area insights…');
    void api<Insight>(`/projects/${encodeURIComponent(project)}/insights${area ? '?area=' + encodeURIComponent(area) : ''}`, undefined, controller.signal).then(r => { setData(r); setMessage(''); }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); }); return () => controller.abort();
  }, [project, area, refresh]);
  return <main className={s.page}><div className={s.shell}><SurveyGuruSidebar active={dashboard ? 'dashboard' : 'opportunities'}/><section className={s.content}>
    <header className={s.header}><div><p className={s.eyebrow}>Live field intelligence</p><h1>{dashboard ? 'Know what needs attention.' : 'Understand your selected area.'}</h1><p>Customer evidence, field activity and review status from your authorised project.</p></div><button onClick={() => setRefresh(v => v + 1)}>Refresh</button></header>
    <div className={s.grid}><label>Project<select value={project} onChange={e => { setProject(e.target.value); setArea(''); }}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Work area<select value={area} onChange={e => setArea(e.target.value)}><option value="">All authorised work areas</option>{data?.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>
    {message && <p role="status" className={s.status}>{message}</p>}
    {data && <><div className={s.metrics}>{[['Submitted customers', data.metrics.submittedCustomers], ['Accepted customers', data.metrics.acceptedCustomers], ['Awaiting QA', data.metrics.awaitingQa], ['Active agents', data.metrics.activeAgents]].map(([label,value]) => <article className={s.card} key={label}><span>{label}</span><strong className={s.metric}>{value}</strong></article>)}</div>
    <section className={s.card}><p className={s.eyebrow}>Management attention</p><h2>What needs action now</h2><div className={s.row}><strong>Customer evidence · {data.metrics.awaitingQa} awaiting review</strong><Link href={`/qa?project=${encodeURIComponent(project)}`}>Open QA →</Link></div><div className={s.row}><strong>Project areas · {data.metrics.submittedAreas} submitted</strong><Link href="/operations">Review project areas →</Link></div><div className={s.row}><strong>Coverage gaps</strong><Link href={`/projects/demo/map?project=${encodeURIComponent(project)}`}>Inspect confirmed street coverage →</Link></div></section>
    <div className={s.grid}><article className={s.card}><p className={s.eyebrow}>Field now</p><h2>Recent recorded activity</h2>{data.fieldActivity.length ? data.fieldActivity.map(a => <div className={s.row} key={a.id}><span><strong>{a.areaName}</strong><small>{a.state.replaceAll('_',' ')} · {a.acceptedPoints} accepted GPS points</small></span><small>{a.lastEvidenceAt ? new Date(a.lastEvidenceAt).toLocaleString() : 'No movement received yet'}</small></div>) : <p>No field sessions are recorded for this selection.</p>}</article>
    <article className={s.card}><p className={s.eyebrow}>Evidence and QA</p><h2>Customer status</h2>{Object.entries(data.statusCounts).map(([status,count]) => <div className={s.row} key={status}><span>{status.replaceAll('_',' ')}</span><strong>{count}</strong></div>)}{!data.metrics.submittedCustomers && <p>No customers have been submitted yet.</p>}</article></div>
    <div className={s.grid}><article className={s.card}><p className={s.eyebrow}>Opportunity signals</p><h2>Observed brand presence</h2>{data.brandPerformance.length ? data.brandPerformance.map(b => <div className={s.row} key={b.brand}><span>{b.brand}</span><strong>{b.stores} stores</strong></div>) : <p>Brand insights appear when agents submit product evidence.</p>}<p>Observed store counts describe captured evidence. They do not establish market demand or sales potential.</p></article><article className={s.card}><h2>Area review status</h2>{data.areas.filter(a => !area || a.id === area).map(a => <div className={s.row} key={a.id}><span>{a.name}</span><strong>{a.reviewState.replaceAll('_',' ')}</strong></div>)}<Link href="/operations">Manage area assignments →</Link><p>Updated {new Date(data.generatedAt).toLocaleString()}</p></article></div>
    <section className={s.card}><h2>{data.project.name} · project street coverage</h2><p>The map shows the full project boundary; the metrics above follow the selected work area.</p><ProjectCoverageMap projectId={project} refreshKey={refresh} variant="dashboard"/></section>
    </>}
  </section></div></main>;
}
