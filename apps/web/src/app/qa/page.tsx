import Link from 'next/link';
import SurveyGuruSidebar from '../../components/SurveyGuruSidebar';
import styles from './qa.module.css';

const queue = [
  ['High','Coverage exception','Dobsonville West','18.6 km remains unsupported by sufficient search evidence','Return to field'],
  ['High','Possible duplicate outlet','Zama’s Tuck Shop','Identity signals overlap with an existing outlet 42 m away','Human review'],
  ['Medium','Photo / evidence','Orlando East · Visit 1841','Product visibility evidence requires confirmation','Review evidence'],
  ['Medium','GPS / location','Meadowlands · Visit 1837','Location accuracy weaker than preferred project threshold','Review context'],
] as const;

const outcomes = [
  ['Accept','Evidence is sufficient and the record can progress.'],
  ['Return for correction','A correctable issue must go back to field.'],
  ['Keep pending','Evidence is preserved while uncertainty is investigated.'],
  ['Reject','Authorised QA rejects the record with reason and audit history.'],
] as const;

export default function QaPage(){
  return <main className={styles.page}><div className={styles.shell}>
    <SurveyGuruSidebar active="qa" />
    <section className={styles.main}><div className={styles.workspace}>
      <header className={styles.header}><div><p className={styles.eyebrow}>Survey Guru · Evidence & QA</p><h1>Resolve uncertainty.<br/>Protect the truth.</h1><p>QA turns preserved field evidence into an auditable quality outcome. Uncertainty is reviewed, never silently rewritten.</p></div><Link className={styles.back} href="/projects/demo/map">Open coverage →</Link></header>

      <section className={styles.metrics}><article><strong>41</strong><span>Awaiting QA</span></article><article><strong>7</strong><span>Coverage exceptions</span></article><article><strong>5</strong><span>Identity reviews</span></article><article><strong>29</strong><span>Evidence checks</span></article></section>

      <section className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Prioritised queue</p><h2>Review by operational impact</h2></div><span>Human authority required</span></div><div className={styles.queue}>{queue.map(([severity,type,place,reason,next])=><article key={`${type}-${place}`}><b className={severity==='High'?styles.high:styles.medium}>{severity}</b><div><strong>{type} · {place}</strong><p>{reason}</p></div><em>{next} →</em></article>)}</div></section>

      <section className={styles.grid}><article className={styles.panel}><p className={styles.eyebrow}>Selected review · Coverage exception</p><h2>Dobsonville West</h2><dl className={styles.detail}><div><dt>Current state</dt><dd>PARTIALLY COVERED</dd></div><div><dt>Supported search</dt><dd>72%</dd></div><div><dt>Outstanding</dt><dd>18.6 km</dd></div><div><dt>Evidence state</dt><dd>Insufficient traversal</dd></div><div><dt>Field source</dt><dd>Team 04 · Search Session</dd></div></dl><p className={styles.note}>False-positive coverage is the higher operational risk. Keep this geography partial until sufficient search evidence is reconciled.</p><div className={styles.actions}><Link href="/field/map">Return to field →</Link><Link href="/projects/demo/map">Inspect map evidence</Link></div></article>

      <article className={styles.panel}><p className={styles.eyebrow}>Governed outcomes</p><h2>Every QA decision leaves history.</h2><div className={styles.outcomes}>{outcomes.map(([title,copy])=><div key={title}><strong>{title}</strong><span>{copy}</span></div>)}</div><p className={styles.note}>Client-side controls are workflow aids only. Final authority belongs to protected API/domain validation and authorised QA permissions.</p></article></section>

      <section className={styles.panel} aria-label="Demo QA resolution"><div className={styles.panelHead}><div><p className={styles.eyebrow}>Demo resolution · authorised QA example</p><h2>Evidence accepted after the search gap is closed</h2></div><span>Example outcome</span></div><dl className={styles.detail}><div><dt>Before QA</dt><dd>SEARCHED · QA PENDING</dd></div><div><dt>QA outcome</dt><dd>ACCEPTED</dd></div><div><dt>Coverage result</dt><dd>VERIFIED</dd></div><div><dt>Opportunity effect</dt><dd>74 outlets evidence-backed</dd></div></dl><p className={styles.note}>This is a demo-state handoff, not a live browser-side approval. In the Firebase/API phase, only an authorised server-side QA action will be able to persist this transition and its audit history.</p><div className={styles.actions}><Link href="/projects/demo/map">See verified coverage →</Link><Link href="/opportunities/demo">Continue to opportunity story →</Link></div></section>

      <section className={styles.flow}><span>Field capture</span><b>→</b><span>Server validation</span><b>→</b><span className={styles.active}>QA review</span><b>→</b><span>Accepted evidence</span><b>→</b><span>Verified coverage</span><b>→</b><span>Opportunity</span></section>
      <footer className={styles.footer}><strong>Evidence before inference.</strong><span>Task Expert Systems</span></footer>
    </div></section>
  </div></main>;
}
