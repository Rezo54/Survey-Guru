import Link from 'next/link';
import { detectRuntimeCapabilities } from '@survey-guru/capabilities';
import styles from './field-today.module.css';

const assignments = [
  ['Dobsonville West', 'Coverage search', '08:00–10:30', 'Priority'],
  ['Meadowlands', 'Outlet verification', '11:00–12:30', 'Ready'],
  ['Orlando East', 'Opportunity validation', '13:30–15:30', 'Ready'],
];

export default function FieldPage() {
  const capabilities = detectRuntimeCapabilities('pwa');
  return <main className={styles.page}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Survey Guru · Field intelligence</p><h1 className={styles.title}>Today</h1><p className={styles.subtle}>Search deliberately. Capture evidence. Leave no geography ambiguous.</p></div><span className={styles.status}>● Offline ready</span></header>

    <section className={styles.hero}><div><p className={styles.eyebrow}>Today&apos;s priority</p><h2>Dobsonville West</h2><p>Close the remaining search gap before moving to outlet verification.</p></div><div className={styles.heroStat}><strong>18.6</strong><span>km remaining</span></div><Link className={styles.heroAction} href="/field/map">Open live map →</Link></section>

    <section className={styles.summary}><div><strong>4.8 km</strong><span>Searched today</span></div><div><strong>12</strong><span>Outlets verified</span></div><div><strong>3</strong><span>Queued offline</span></div></section>

    <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Work queue</p><h2>Assignments</h2></div><span className={styles.pill}>3 active</span></div><div className={styles.list}>{assignments.map(([place,type,time,state],i)=><article className={styles.assignment} key={place}><div className={styles.order}>{i+1}</div><div><strong>{place}</strong><span>{type} · {time}</span></div><em className={state==='Priority'?styles.priority:''}>{state}</em></article>)}</div></section>

    <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Device & evidence</p><h2>Ready to work</h2></div></div><dl className={styles.readiness}><div><dt>PWA & offline shell</dt><dd>Ready</dd></div><div><dt>Foreground search</dt><dd>Available</dd></div><div><dt>Background coverage</dt><dd>{capabilities.backgroundLocation?'Available':'Android required'}</dd></div><div><dt>Protected business API</dt><dd>Awaiting dev auth</dd></div></dl></section>

    <nav className={styles.nav} aria-label="Field navigation"><Link className={styles.active} href="/field">Today</Link><span>Assignments</span><Link href="/field/map">Map</Link><span>Sync</span></nav>
  </main>;
}
