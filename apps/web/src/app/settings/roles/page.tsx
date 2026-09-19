'use client';
import { useEffect, useState } from 'react';
import SurveyGuruSidebar from '../../../components/SurveyGuruSidebar';
import { api } from '../../../lib/api';
import s from '../../../components/Workspace.module.css';
type People = { people: { id: string; name: string; email: string; roleKey: string | null; roleKeys?: string[] }[]; roles: { key: string; name?: string; permissions: string[] }[]; assignablePermissions: string[]; moreAccountsAvailable: boolean };
export default function RolesPage() {
  const [data, setData] = useState<People | null>(null); const [message, setMessage] = useState('Loading role administration…'); const [busy, setBusy] = useState(false);
  async function load() { setData(await api<People>('/admin/people')); setMessage(''); }
  useEffect(() => { void load().catch(e => setMessage(e.message)); }, []);
  async function save(path: string, body: unknown) { setBusy(true); try { await api(path, body); await load(); setMessage('Role saved. New access applies to the next API request.'); } catch(e) { setMessage((e as Error).message); } finally { setBusy(false); } }
  return <main className={s.page}><div className={s.shell}><SurveyGuruSidebar active="settings"/><section className={s.content}><p className={s.eyebrow}>Super administrator</p><h1>People and roles</h1><p>New accounts remain pending until you activate them with a role. API permissions enforce access even when a page URL is opened directly.</p>{message && <p className={s.status} role="status">{message}</p>}
    {data && <><form className={`${s.card} ${s.form}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void save('/admin/roles', { name: f.get('name'), permissions: f.getAll('permission') }); }}><h2>Define a role</h2><label>Role name<input name="name" required maxLength={60}/></label><div className={s.checks}>{data.assignablePermissions.map(p => <label key={p}><input type="checkbox" name="permission" value={p}/>{p}</label>)}</div><button disabled={busy}>Create role</button></form>
    <div className={s.grid}>{data.people.map(person => <form className={`${s.card} ${s.form}`} key={person.id} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void save(`/admin/people/${encodeURIComponent(person.id)}/role`, { roleKeys: f.getAll('role') }); }}><h2>{person.name || person.email}</h2><p>{person.email}</p><p>{person.roleKey ? `Current roles: ${(person.roleKeys ?? [person.roleKey]).join(' + ')}` : 'Pending activation'}</p><fieldset><legend>Assigned roles (select one or more)</legend>{data.roles.map(r => <label key={r.key}><input type="checkbox" name="role" value={r.key} defaultChecked={(person.roleKeys ?? [person.roleKey]).includes(r.key)}/>{r.name ?? r.key}</label>)}</fieldset><button disabled={busy}>Save access</button></form>)}</div>{data.moreAccountsAvailable && <p>More than 1,000 accounts exist. Use Firebase administration for accounts beyond this list.</p>}</>}
  </section></div></main>;
}
