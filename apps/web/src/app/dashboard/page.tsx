import Link from 'next/link';

const metrics = [
  ['Active projects', '12', '3 need attention'],
  ['Verified outlets', '1,846', '327 newly discovered'],
  ['Field coverage', '72%', '+8 pts this week'],
  ['Opportunity', '7 clusters', '312 priority outlets'],
];

const activity = [
  ['Team 04', 'Dobsonville', 'Searching', '18.6 km remains'],
  ['Team 02', 'Meadowlands', 'Verifying', '12 outlets today'],
  ['Team 07', 'Orlando East', 'Synced', 'Evidence accepted'],
];

export default function DashboardPage() {
  return <main className="app-shell premium-shell">
    <aside className="sidebar premium-sidebar">
      <div className="brand brand-lockup"><span className="brand-mark">▲</span><span>Survey Guru<small>See more. Know sooner. Move further.</small></span></div>
      <nav className="nav-list premium-nav"><Link className="active" href="/dashboard">⌂ <span>Home</span></Link><Link href="/projects/demo/map">◇ <span>Map & Coverage</span></Link><Link href="/field">◎ <span>Field Today</span></Link><Link href="/field/map">⌖ <span>Field Live Map</span></Link><a href="#opportunities">✦ <span>Opportunities</span></a><a href="#evidence">▤ <span>Evidence & QA</span></a></nav>
      <div className="sidebar-story"><strong>Real places.<br/>Real evidence.<br/>Real opportunities.</strong><span>A Task Expert Systems product</span></div>
    </aside>
    <section className="workspace premium-workspace">
      <header className="topbar premium-topbar"><div className="topbar-title"><button className="menu-button" aria-label="Open navigation">☰</button><div className="search-box">⌕ <span>Search locations, projects, outlets or opportunities…</span><kbd>Ctrl K</kbd></div></div><div className="topbar-meta"><span className="pill online">● Online</span><span className="user-chip">B <span>Benedict<small>Taskraft · TES workspace</small></span></span></div></header>
      <div className="content premium-content">
        <div className="premium-heading"><div><p className="eyebrow">South Africa · Market intelligence</p><h1>See the market differently.</h1><p>Capture truth. Reveal opportunity. Tell the story.</p></div><Link className="button neon" href="/projects/demo/map">Explore the map →</Link></div>
        <section className="metric-grid premium-metrics">{metrics.map(([label,value,note]) => <article className="metric dark-metric" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note">{note}</div></article>)}</section>
        <section className="premium-dashboard-grid">
          <article className="panel dark-panel map-command"><div className="panel-header"><div><p className="eyebrow">Live market picture</p><h2>Soweto Retail Universe</h2></div><span className="pill online">72% searched</span></div><div className="map-stage dark-map"><div className="map-grid"/><div className="map-orbit orbit-one"/><div className="map-orbit orbit-two"/><div className="road h1"/><div className="road h2"/><div className="road v1"/><div className="road v2"/><div className="coverage covered c1"/><div className="coverage partial c2"/><div className="coverage outstanding c3"/><div className="coverage outstanding c4"/><div className="opportunity-pulse pulse-one"><b>74</b><span>priority outlets</span></div><div className="opportunity-pulse pulse-two"><b>03</b><span>growth cluster</span></div><div className="map-label zone">Dobsonville · search gap</div><div className="map-label worker">Team 04 · active</div><div className="map-legend"><span><i className="legend-dot covered"/>Searched</span><span><i className="legend-dot partial"/>Partial</span><span><i className="legend-dot outstanding"/>Unknown</span></div><Link className="map-explore" href="/projects/demo/map">Open authoritative coverage →</Link></div></article>
          <aside className="panel dark-panel opportunity-card" id="opportunities"><div className="panel-header"><div><p className="eyebrow">Opportunity insight</p><h2>Cluster 03 is strengthening</h2></div><span className="opportunity-badge">HIGH</span></div><div className="opportunity-visual"><span>74</span><small>verified outlets now match the priority profile</small></div><div className="opportunity-signals"><span>↑ Outlet density</span><span>↑ Category potential</span><span>✓ Search evidence reconciled</span></div><div className="opportunity-copy"><strong>What it means</strong><p>The field picture is moving from discovery to a credible growth case. Validate the remaining geography before committing the next action.</p></div><Link className="button neon wide" href="/projects/demo/map">Explore opportunity →</Link></aside>
        </section>
        <section className="lower-intelligence-grid">
          <article className="panel dark-panel"><div className="panel-header"><div><p className="eyebrow">Field progress</p><h2>Evidence becoming intelligence</h2></div><strong className="coverage-ring">72%</strong></div><div className="progress-story"><div><b>1,846</b><span>Verified outlets</span></div><div><b>118 km</b><span>Still outstanding</span></div><div><b>41</b><span>Awaiting QA</span></div></div><div className="progress premium-progress"><span style={{width:'72%'}}/></div><p className="panel-caption">Unknown geography stays visible until search evidence proves otherwise.</p></article>
          <article className="panel dark-panel"><div className="panel-header"><div><p className="eyebrow">Live field activity</p><h2>What is happening now</h2></div><span className="pill online">● Live</span></div><div className="activity-list">{activity.map(([team,place,state,note]) => <div className="activity-row" key={team}><span className="activity-pin">●</span><div><strong>{team} · {place}</strong><small>{note}</small></div><em>{state}</em></div>)}</div><Link className="text-link" href="/field/map">Open field live map →</Link></article>
          <article className="panel dark-panel" id="evidence"><div className="panel-header"><div><p className="eyebrow">Evidence & QA</p><h2>41 visits need attention</h2></div></div><div className="evidence-card"><div className="evidence-photo">PHOTO<br/><span>Outlet evidence</span></div><div><strong>Zama&apos;s Tuck Shop</strong><p>Identity and location evidence synced. Product visibility requires QA.</p><span className="pill ok">✓ Synced</span></div></div><a className="text-link" href="#evidence">Review evidence queue →</a></article>
        </section>
      </div>
    </section>
  </main>;
}
