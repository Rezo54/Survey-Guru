import Link from 'next/link';

const metrics = [
  ['Coverage', '72%', '+8 pts this week'],
  ['Verified outlets', '1,846', '327 newly discovered'],
  ['QA accepted', '96.8%', '41 awaiting review'],
  ['Outstanding', '118 km', '14 priority pockets'],
  ['Opportunity', '7 clusters', '312 priority outlets'],
];

export default function DashboardPage() {
  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand">Survey Guru<small>TES — Task Expert Systems</small></div>
      <nav className="nav-list"><Link className="active" href="/dashboard">Overview</Link><Link href="/projects/demo/map">Map & Coverage</Link><Link href="/field">Field</Link></nav>
      <div className="sidebar-footer">Configuration-safe local checkpoint</div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div className="topbar-title"><button className="menu-button" aria-label="Open navigation">☰</button><span className="workspace-name">Soweto Retail Universe</span></div><div className="topbar-meta"><span className="pill ok">● Field sync healthy</span><span className="pill">Client view · Draft</span></div></header>
      <div className="content">
        <div className="page-heading"><div><p className="eyebrow">Project command centre</p><h1>What deserves attention today?</h1><p className="subtle">Geography first. Exceptions second. Supporting numbers only where they change action.</p></div><div className="action-row"><Link className="button primary" href="/projects/demo/map">Open live coverage</Link><Link className="button" href="/">Project entry</Link></div></div>
        <section className="metric-grid">{metrics.map(([label,value,note]) => <article className="metric" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>)}</section>
        <section className="dashboard-grid">
          <article className="panel"><div className="panel-header"><h2>Live coverage</h2><Link href="/projects/demo/map">Explore map →</Link></div><div className="map-stage"><div className="map-grid"/><div className="road h1"/><div className="road h2"/><div className="road v1"/><div className="road v2"/><div className="coverage covered c1"/><div className="coverage partial c2"/><div className="coverage outstanding c3"/><div className="coverage outstanding c4"/><div className="map-label zone">West cluster</div><div className="map-label worker">Team 04 · active</div><div className="map-legend"><span><i className="legend-dot covered"/>Searched</span><span><i className="legend-dot partial"/>Partial</span><span><i className="legend-dot outstanding"/>Outstanding</span></div></div></article>
          <aside className="panel"><div className="panel-header"><h2>Needs attention</h2><span className="pill warn">3 material</span></div><div className="panel-body attention-list"><div className="attention-item"><strong>Dobsonville is falling behind</strong><span>18.6 km remains unsearched. Rebalance the next assignment wave.</span></div><div className="attention-item"><strong>Opportunity cluster 03 is strengthening</strong><span>74 verified outlets now meet the current priority profile.</span></div><div className="attention-item"><strong>41 visits await QA</strong><span>Most are evidence-quality checks, not recapture failures.</span></div></div></aside>
        </section>
      </div>
    </section>
  </main>;
}
