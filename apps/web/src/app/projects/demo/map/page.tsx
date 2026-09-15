import Link from 'next/link';
import SurveyGuruSidebar from '../../../../components/SurveyGuruSidebar';
import ProjectGoogleMap from './ProjectGoogleMap';
import styles from './project-map.module.css';

const metrics = [['⌖','1,846','Verified outlets'],['◔','72%','Reconciled'],['▥','118 km','Outstanding'],['◷','41','Awaiting QA']];
const opportunities = [['74','Retail Cluster 03 – Dobsonville','74 verified priority-profile outlets'],['32','Growth Corridor – Main Road','32 evidence-backed potential outlets'],['18','Underserved Area – Meadowlands','18 candidates · verification incomplete']];
type QueueTone = 'red' | 'amber' | 'green';
const fieldQueue: ReadonlyArray<readonly [QueueTone,string,string]> = [['red','Dobsonville West','18.6 km unknown · search required · Team 04'],['amber','Meadowlands','Partial coverage · 12 outlet verifications · Team 02'],['amber','Orlando East','Searched · evidence awaiting QA · Team 06'],['green','Pimville','Verified coverage · Team 03']];
const coverageStates = [
    ['Searched + verified', 'Field movement and outlet evidence reconciled', 'Decision-ready'],
    ['Searched · QA pending', 'Search evidence exists; verification is incomplete', 'Hold inference'],
    ['Partially searched', 'Some streets or evidence remain outstanding', 'Return to field'],
    ['Unknown', 'No sufficient search evidence exists', 'Do not infer'],
] as const;

export default function ProjectMapPage() {
    return <main className={styles.page}><div className={styles.shell}>
        <SurveyGuruSidebar active="project-map" />
        <section className={styles.main}>
            <header className={styles.top}><div className={styles.search}>⌕ &nbsp; Search streets, outlets, teams or opportunities…</div><div className={styles.topRight}><button className={styles.location}>⌖ &nbsp; Soweto⌄</button><span className={styles.bell}>♧</span><span className={styles.user}>B</span></div></header>
            <div className={styles.content}>
                <section className={styles.heading}><div><h1>Project Map & Coverage</h1><p>Know what was searched, what is verified and what remains unknown.</p></div><div className={styles.projectSelect}><span>Soweto Retail Universe</span><b>Active</b></div></section>
                <section className={styles.mapPanel}><div className={styles.mapToolbar}><div className={styles.mapTypes}><span className={styles.selected}>Map</span><span>Satellite</span><span>Hybrid</span><span>Terrain</span></div><div className={styles.mapTools}><button>▱ Layers</button><button>▽ Filter</button><button>⌾ Locate</button><button>⛶</button></div></div><ProjectGoogleMap /></section>
                <section className={styles.metrics}>{metrics.map(([icon,value,label]) => <article key={label}><i>{icon}</i><div><strong>{value}</strong><span>{label}</span></div></article>)}</section>

                <section className={styles.insightPanel} aria-label="Coverage evidence model">
                    <div className={styles.panelTitle}><h2>◉ &nbsp; Coverage Evidence Model</h2><Link href="/field/map">Open live field evidence →</Link></div>
                    <div className={styles.queue}>{coverageStates.map(([state,evidence,action], index) => <div key={state}><i className={index === 0 ? styles.green : index === 3 ? styles.red : styles.amber} /><div><strong>{state}</strong><span>{evidence} · {action}</span></div></div>)}</div>
                </section>

                <section className={styles.lowerGrid}>
                    <article className={styles.insightPanel}><div className={styles.panelTitle}><h2>◎ &nbsp; Opportunity Signals</h2><Link href="/opportunities/demo">View all →</Link></div><div className={styles.signalList}>{opportunities.map(([score,title,copy],index) => <Link href="/opportunities/demo" key={title} className={styles.signalRow}><b className={`${styles.score} ${index===0?styles.hot:styles.warm}`}>{score}</b><div><strong>{title}</strong><span>{copy}</span></div><em>›</em></Link>)}</div></article>
                    <article className={styles.insightPanel}><div className={styles.panelTitle}><h2>♙ &nbsp; Field Queue (Today)</h2><Link href="/field">Open Field Today →</Link></div><div className={styles.queue}>{fieldQueue.map(([tone,title,copy]) => <div key={title}><i className={styles[tone]} /><div><strong>{title}</strong><span>{copy}</span></div></div>)}</div></article>
                </section>
                <section className={styles.insightPanel} aria-label="Demo review handoff"><div className={styles.panelTitle}><h2>◆ &nbsp; Evidence awaiting decision</h2><Link href="/qa">Open QA queue →</Link></div><div className={styles.queue}><div><i className={styles.amber}/><div><strong>Dobsonville West · Searched segment</strong><span>Field evidence captured · reconciliation required before coverage can become verified</span></div></div></div></section>
                <footer className={styles.footer}><span><strong>Survey Guru</strong> · Turning field reality into trusted intelligence.</span><span>Task Expert Systems · People | Places | Opportunities</span></footer>
            </div>
        </section>
    </div></main>;
}
