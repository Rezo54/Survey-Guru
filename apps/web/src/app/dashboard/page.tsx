import Link from 'next/link';
import SurveyGuruSidebar from '../../components/SurveyGuruSidebar';
import ProjectSummaryCheckpoint from './ProjectSummaryCheckpoint';
import styles from './dashboard.module.css';

const metrics = [
    ['Active projects', '12', '3 need attention'],
    ['Locations surveyed', '1,846', '327 newly discovered'],
    ['Field coverage', '72%', '+8 pts this week'],
    ['High-potential areas', '7', '312 priority outlets'],
];

const activity = [
    ['Team 04 · Dobsonville', 'Searching · 18.6 km remains'],
    ['Team 02 · Meadowlands', 'Verifying · 12 outlets today'],
    ['Team 07 · Orlando East', 'Synced · evidence accepted'],
];

const attention = [
    ['Coverage gap', 'Dobsonville West', '18.6 km remains unknown', '/projects/demo/map'],
    ['QA queue', '41 visits', 'Evidence requires review', '/qa'],
    ['Opportunity', 'Cluster 03', '74 verified priority outlets', '/opportunities/demo'],
] as const;

export default function DashboardPage() {
    return (
        <main className={styles.page}>
            <div className={styles.shell}>
                <SurveyGuruSidebar active="dashboard" />
                <section className={styles.main}>
                    <header className={styles.top}><div className={styles.search}>⌕ &nbsp; Search locations, projects, outlets or opportunities…</div><div className={styles.user}><span className={styles.avatar}>B</span><span>Benedict<small>Taskraft · TES workspace</small></span></div></header>
                    <div className={styles.content}>
                        <section className={styles.intro}><div><p className={styles.eyebrow}>South Africa · Live market intelligence</p><h1>Markets are talking.<br />We show you where.</h1><p>Geospatial intelligence for real opportunities. Capture. Understand. Act.</p></div><Link className={styles.cta} href="/projects/demo/map">Open the map →</Link></section>
                        <section className={styles.metrics}>{metrics.map(([l,v,n])=><article className={styles.metric} key={l}><span>{l}</span><strong>{v}</strong><small>{n}</small></article>)}</section>
                        <section className={styles.panel} aria-label="Management attention"><div className={styles.panelHead}><div><p className={styles.eyebrow}>Management attention</p><h2>What needs action now</h2></div><span className={styles.status}>3 signals</span></div><div className={styles.activity}>{attention.map(([kind,title,copy,href])=><Link className={styles.link} href={href} key={kind}><strong>{kind} · {title}</strong><small>{copy} →</small></Link>)}</div></section>
                        <section className={styles.heroGrid}><article className={styles.panel}><div className={styles.panelHead}><div><p className={styles.eyebrow}>Live market picture</p><h2>Soweto Retail Universe</h2></div><span className={styles.status}>● 72% searched</span></div><ProjectSummaryCheckpoint /><div className={styles.map}><div className={styles.grid}/><div className={styles.dots}/><div className={`${styles.road} ${styles.r1}`}/><div className={`${styles.road} ${styles.r2}`}/><div className={`${styles.road} ${styles.r3}`}/><div className={styles.covered}/><div className={styles.partial}/><div className={`${styles.cluster} ${styles.c1}`}>74</div><div className={`${styles.cluster} ${styles.c2}`}>03</div><div className={styles.legend}><span><i/>Searched / verified</span><span><i/>Partial evidence</span><span><i/>High opportunity</span></div><Link className={styles.mapCta} href="/projects/demo/map">Explore authoritative coverage →</Link></div></article>
                        <aside className={`${styles.panel} ${styles.opportunity}`}><p className={styles.eyebrow}>Opportunity insight · Cluster 03</p><h2>Dobsonville is becoming a credible growth case.</h2><div className={styles.big}>74</div><div className={styles.muted}>verified outlets match the priority profile</div><div className={styles.signals}><span>↑ Outlet density strengthening</span><span>↑ Category potential emerging</span><span>✓ Core evidence reconciled</span></div><p>The opportunity is strong enough to focus attention, but the western search gap must still be closed before a network decision.</p><Link className={styles.cta} href="/opportunities/demo">Explore the opportunity →</Link></aside></section>
                        <section className={styles.lower}><article className={`${styles.panel} ${styles.mini}`}><p className={styles.eyebrow}>Coverage intelligence</p><h3>Understand what has been searched. See what is next.</h3><div className={styles.stats}><div><strong>118 km</strong><span>Outstanding</span></div><div><strong>41</strong><span>Awaiting QA</span></div><div><strong>72%</strong><span>Reconciled</span></div></div><div className={styles.progress}><i/></div><Link className={styles.link} href="/projects/demo/map">Open Project Map & Coverage →</Link></article>
                        <article className={`${styles.panel} ${styles.mini}`}><p className={styles.eyebrow}>Field now</p><h3>Reality becoming evidence.</h3><div className={styles.activity}>{activity.map(([a,b])=><div key={a}><strong>{a}</strong><small>{b}</small></div>)}</div><Link className={styles.link} href="/field/map">Open Field Live Map →</Link></article>
                        <article className={`${styles.panel} ${styles.mini}`} id="evidence"><p className={styles.eyebrow}>Evidence & QA</p><h3>41 visits need attention.</h3><div className={styles.evidence}><div className={styles.photo}>OUTLET<br/>EVIDENCE</div><div><strong>Zama&apos;s Tuck Shop</strong><p>Identity and location evidence synced. Product visibility requires QA.</p></div></div><Link className={styles.link} href="/qa">Review evidence queue →</Link></article></section>
                    </div>
                </section>
            </div>
        </main>
    );
}
