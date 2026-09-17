import Link from 'next/link';
import SurveyGuruSidebar from '../../components/SurveyGuruSidebar';
import QaReviewQueue from './QaReviewQueue';
import styles from './qa.module.css';

export default async function QaPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const parameters = await searchParams;
  const projectId = parameters.project ?? 'prj_soweto_retail_universe';
  return <main className={styles.page}><div className={styles.shell}>
    <SurveyGuruSidebar active="qa" />
    <section className={styles.main}><div className={styles.workspace}>
      <header className={styles.header}><div><p className={styles.eyebrow}>Survey Guru · Evidence &amp; QA</p><h1>Verify the store.<br/>Protect the truth.</h1><p>Review the questionnaire, location and protected storefront evidence before allowing a captured store into an export queue.</p></div><Link className={styles.back} href="/projects/demo/map">Open coverage →</Link></header>
      <QaReviewQueue projectId={projectId} />
      <section className={styles.flow}><span>Field capture</span><b>→</b><span>Server validation</span><b>→</b><span className={styles.active}>QA review</span><b>→</b><span>Export-ready</span></section>
      <footer className={styles.footer}><strong>Evidence before inference.</strong><span>Task Expert Systems</span></footer>
    </div></section>
  </div></main>;
}
