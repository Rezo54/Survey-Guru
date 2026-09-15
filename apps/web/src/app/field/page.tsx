import Link from 'next/link';
import { detectRuntimeCapabilities } from '@survey-guru/capabilities';
import SurveyGuruSidebar from '../../components/SurveyGuruSidebar';
import styles from './field-today.module.css';

const assignments = [
  ['Dobsonville West', 'Coverage search', '08:00–10:30', 'Unknown → search', 'Priority'],
  ['Meadowlands', 'Outlet verification', '11:00–12:30', 'Partial → verify', 'Ready'],
  ['Orlando East', 'Evidence reconciliation', '13:30–15:30', 'QA pending → reconcile', 'Ready'],
] as const;

const evidenceFlow = [
  ['1', 'Search geography', 'Movement establishes where fieldwork actually occurred.'],
  ['2', 'Capture outlets', 'Outlet evidence is attached to searched geography.'],
  ['3', 'Reconcile & QA', 'Evidence is checked before geography becomes verified.'],
  ['4', 'Release intelligence', 'Only verified evidence can support decision-ready opportunity.'],
] as const;

export default function FieldPage() {
  const capabilities = detectRuntimeCapabilities('pwa');
  return <main className={styles.page}><div className={styles.shell}>
    <SurveyGuruSidebar active="field" />
    <section className={styles.main}><div className={styles.workspace}>
      <header className={styles.header}><div><p className={styles.eyebrow}>Survey Guru · Field Today</p><h1 className={styles.title}>Your day, clearly in focus.</h1><p className={styles.subtle}>Search deliberately. Capture evidence. Leave no geography ambiguous.</p></div><div className={styles.headerActions}><span className={styles.status}>● Offline ready</span><Link className={styles.dashboardLink} href="/dashboard">Dashboard</Link></div></header>
      <section className={styles.hero}><div><p className={styles.eyebrow}>Today&apos;s priority · Unknown geography</p><h2>Dobsonville West</h2><p>Close the remaining search gap before moving to outlet verification. Unknown streets stay visible until search evidence exists.</p><div className={styles.heroTags}><span>Coverage search</span><span>Team 04</span><span>GPS good</span></div></div><div className={styles.heroStat}><strong>18.6</strong><span>km remaining</span></div><Link className={styles.heroAction} href="/field/map">Start / resume field map →</Link></section>
      <section className={styles.summary}><div><strong>4.8 km</strong><span>Searched today</span></div><div><strong>12</strong><span>Outlets verified</span></div><div><strong>3</strong><span>Queued offline</span></div><div><strong>0</strong><span>Exceptions</span></div></section>
      <section className={styles.workGrid}><article className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Work queue</p><h2>Assignments by evidence state</h2></div><span className={styles.pill}>3 active</span></div><div className={styles.list}>{assignments.map(([place,type,time,transition,state],i)=><div className={styles.assignment} key={place}><div className={styles.order}>{i+1}</div><div><strong>{place}</strong><span>{type} · {time} · {transition}</span></div><em className={state==='Priority'?styles.priority:''}>{state}</em></div>)}</div></article>
      <article className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Live position</p><h2>Field route</h2></div><Link className={styles.mapLink} href="/field/map">Open →</Link></div><div className={styles.mapPreview}><div className={styles.mapGrid}/><div className={styles.route}/><span className={`${styles.pin} ${styles.p1}`}/><span className={`${styles.pin} ${styles.p2}`}/><span className={`${styles.pin} ${styles.p3}`}/><div className={styles.position}>YOU</div></div><div className={styles.mapStats}><span><b>28.4 km</b> distance</span><span><b>12</b> locations</span><span><b>14 min</b> avg/stop</span></div></article></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Evidence progression</p><h2>From field movement to trusted intelligence</h2></div><Link className={styles.mapLink} href="/projects/demo/map">Coverage view →</Link></div><div className={styles.list}>{evidenceFlow.map(([step,title,copy])=><div className={styles.assignment} key={step}><div className={styles.order}>{step}</div><div><strong>{title}</strong><span>{copy}</span></div></div>)}</div></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Device & evidence</p><h2>Ready to work</h2></div><span className={styles.pill}>Protected workflow</span></div><dl className={styles.readiness}><div><dt>PWA & offline shell</dt><dd>Ready</dd></div><div><dt>Foreground search</dt><dd>Available</dd></div><div><dt>Background coverage</dt><dd>{capabilities.backgroundLocation?'Available':'Android required'}</dd></div><div><dt>Protected business API</dt><dd>Awaiting dev auth</dd></div></dl></section>
      <nav className={styles.nav} aria-label="Field navigation"><Link className={styles.active} href="/field">Today</Link><span>Assignments</span><Link href="/field/map">Map</Link><span>Sync</span></nav>
    </div></section>
  </div></main>;
}
