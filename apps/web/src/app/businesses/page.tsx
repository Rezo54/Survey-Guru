'use client';
import {useEffect, useState} from 'react';
import SurveyGuruSidebar from '../../components/SurveyGuruSidebar';
import {api} from '../../lib/api';
import s from '../../components/Workspace.module.css';
type Person={id:string;email:string;status:string;admin:boolean;capture:boolean;projectIds:string[]};
type Detail={name:string;canAppointAdmin:boolean;people:Person[];projects:{id:string;name:string}[]};
export default function Businesses(){
 const [list,setList]=useState<{canCreate:boolean;businesses:{id:string;name:string}[]} | null>(null);
 const [selected,setSelected]=useState('');const [detail,setDetail]=useState<Detail|null>(null);const [message,setMessage]=useState('Loading businesses…');const [busy,setBusy]=useState(false);
 useEffect(()=>{void api<NonNullable<typeof list>>('/businesses').then(d=>{setList(d);setMessage('');if(d.businesses.length===1)setSelected(d.businesses[0]!.id);}).catch(e=>setMessage(e.message));},[]);
 useEffect(()=>{let cancelled=false;setDetail(null);if(selected)void api<Detail>(`/businesses/${encodeURIComponent(selected)}`).then(d=>{if(!cancelled){setDetail(d);setMessage('');}}).catch(e=>{if(!cancelled)setMessage(e.message);});return()=>{cancelled=true;};},[selected]);
 async function save(path:string,body:unknown){if(busy)return;setBusy(true);try{await api(path,body);setList(await api<NonNullable<typeof list>>('/businesses'));if(selected)setDetail(await api<Detail>(`/businesses/${encodeURIComponent(selected)}`));setMessage('Saved. Access changes apply to the next API request.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 function employee(person?:Person){return <form key={person?.id??'new'} className={`${s.card} ${s.form}`} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save(`/businesses/${encodeURIComponent(selected)}/people`,{email:f.get('email'),role:f.get('role'),capture:f.get('capture')==='on',active:f.get('active')==='on',projectIds:f.getAll('project')});}}>
 <h2>{person?'Employee access':'Add employee'}</h2><label>Account email<input name="email" type="email" required maxLength={254} defaultValue={person?.email} readOnly={!!person}/></label>
 <label>Role<select name="role" defaultValue={person?.admin?'admin':'viewer'}><option value="viewer">Report viewer</option>{detail?.canAppointAdmin&&<option value="admin">Business administrator</option>}</select></label>
 <label><input name="capture" type="checkbox" defaultChecked={person?.capture}/>Allow field capture (an area assignment is also required)</label>
 <label><input name="active" type="checkbox" defaultChecked={!person||person.status==='active'}/>Active employee</label>
 <fieldset><legend>Projects this employee may access</legend>{detail?.projects.map(p=><label key={p.id}><input type="checkbox" name="project" value={p.id} defaultChecked={person?.projectIds.includes(p.id)}/>{p.name}</label>)}{!detail?.projects.length&&<p>No projects are available in this business yet. Existing TES projects are not shared automatically.</p>}</fieldset>
 <button disabled={busy}>Save employee access</button></form>;}
 return <main className={s.page}><div className={s.shell}><SurveyGuruSidebar active="businesses"/><section className={s.content}><p className={s.eyebrow}>Business administration</p><h1>Businesses and users</h1><p>Manage employees and access within each business. Employees must first request a Survey Guru account using their work email.</p>{message&&<p role="status" className={s.status}>{message}</p>}
 {list?.canCreate&&<form className={`${s.card} ${s.form}`} onSubmit={e=>{e.preventDefault();void save('/businesses',{name:new FormData(e.currentTarget).get('name')});}}><h2>Create a business</h2><label>Business name<input name="name" required maxLength={120}/></label><button disabled={busy}>Create business</button></form>}
 <label>Business<select value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}><option value="">Select a business</option>{list?.businesses.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>
 {detail&&<><h2>{detail.name}</h2><div className={s.grid}>{employee()}{detail.people.map(p=>p.admin&&!detail.canAppointAdmin?<article className={s.card} key={p.id}><h2>{p.email}</h2><p>Business administrator · {p.status}. Contact TES to change this administrator.</p></article>:employee(p))}</div></>}
 </section></div></main>;
}
