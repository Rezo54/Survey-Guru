'use client';
import { useState } from 'react';
import Link from 'next/link';
import DemoStoreMap from '../../components/DemoStoreMap';
import PublicNav from '../../components/PublicNav';
import s from '../public.module.css';
const views = [
  { title:'See the market clearly.', label:'Management overview', copy:'Bring field coverage, verified outlets and unresolved evidence into one decision view.', metrics:[['Verified outlets','1,846'],['Reconciled evidence','72%'],['Awaiting QA','41']], detail:'Illustrative priority: close the western coverage gap before making a network decision.' },
  { title:'Give every street a status.', label:'Field operations', copy:'Assign work areas, record agent movement and keep store evidence connected to its project.', metrics:[['Active teams','8'],['Distance outstanding','118 km'],['Stores captured today','62']], detail:'Illustrative field queue: Dobsonville West → Meadowlands → Orlando East.' },
  { title:'Turn evidence into confidence.', label:'Area opportunity', copy:'Compare observed brand presence and customer evidence for the area you select.', metrics:[['Priority-profile outlets','74'],['Candidate locations','18'],['Accepted area reviews','6']], detail:'Illustrative opportunity: a retail cluster with strong observed outlet density and an outstanding search gap.' },
];
export default function DemoPage() {
  const [selected,setSelected] = useState(0); const view = views[selected]!;
  return <main className={s.page}><div className={s.wrap}><PublicNav/><p className={s.notice}>Presentation demo · All names and figures below are illustrative. No live customer or agent information is used.</p><div className={s.actions}>{views.map((v,i) => <button key={v.label} className={i === selected ? s.button : s.secondary} style={{color:'inherit',background:i === selected ? undefined : 'transparent',cursor:'pointer'}} onClick={() => setSelected(i)}>{v.label}</button>)}</div><section className={s.hero}><div><p className={s.eyebrow}>{view.label}</p><h1>{view.title}</h1><p>{view.copy}</p><Link className={s.button} href="/consultation">Discuss your project →</Link></div></section><DemoStoreMap/><div className={s.grid}>{view.metrics.map(([label,value]) => <article className={s.card} key={label}><span>{label}</span><strong className={s.metric}>{value}</strong><small>Demo figure</small></article>)}</div><article className={s.card}><h2>What needs attention</h2><p>{view.detail}</p></article></div></main>;
}
