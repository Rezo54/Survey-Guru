import Link from 'next/link';
import { detectRuntimeCapabilities } from '@survey-guru/capabilities';
import SurveyGuruSidebar from '../../components/SurveyGuruSidebar';
import AuthorisedAssignment from './AuthorisedAssignment';
import styles from './field-today.module.css';

const evidenceFlow = [
  ['1', 'Search geography', 'Movement establishes where fieldwork actually occurred.'],
  ['2', 'Capture outlets', 'Outlet evidence is attached to searched geography.'],
  ['3', 'Reconcile exceptions', 'Only unusual evidence is sent for human review.'],
  ['4', 'Release intelligence', 'Verified evidence becomes available to governed integrations.'],
] as const;

export default function FieldPage() {
  const capabilities = detectRuntimeCapabilities('pwa');
  return <main className={styles.page}><div className={styles.shell}>
    <SurveyGuruSidebar active="field" />
    <section className={styles.main}><div className={styles.workspace}>
      <header className={styles.header}><div><p className={styles.eyebrow}>Survey Guru · Field Today</p><h1 className={styles.title}>Your day, clearly in focus.</h1><p className={styles.subtle}>Select an assignment, search its authorised area and capture store evidence.</p></div><div className={styles.headerActions}><span className={styles.status}>● Offline ready</span><Link className={styles.dashboardLink} href="/dashboard">Dashboard</Link></div></header>
      <AuthorisedAssignment />
      <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Evidence progression</p><h2>From field movement to trusted intelligence</h2></div></div><div className={styles.list}>{evidenceFlow.map(([step,title,copy]) => <div className={styles.assignment} key={step}><div className={styles.order}>{step}</div><div><strong>{title}</strong><span>{copy}</span></div></div>)}</div></section>
      <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Device & evidence</p><h2>Ready to work</h2></div><span className={styles.pill}>Protected workflow</span></div><dl className={styles.readiness}><div><dt>PWA & offline shell</dt><dd>Ready</dd></div><div><dt>Foreground search</dt><dd>Available</dd></div><div><dt>Background coverage</dt><dd>{capabilities.backgroundLocation ? 'Available' : 'Android required'}</dd></div><div><dt>Business API</dt><dd>Identity scoped</dd></div></dl></section>
      <nav className={styles.nav} aria-label="Field navigation"><Link className={styles.active} href="/field">Today</Link><Link href="/field">Assignments</Link><Link href="/field/map">Map</Link><span>Sync</span></nav>
    </div></section>
  </div></main>;
}
