import Link from 'next/link';

export default function ProjectMapPage() {
  return <main className="app-shell">
    <aside className="sidebar"><div className="brand">Survey Guru<small>TES — Task Expert Systems</small></div><nav className="nav-list"><Link href="/dashboard">Overview</Link><Link className="active" href="/projects/demo/map">Map & Coverage</Link><Link href="/field">Field</Link></nav><div className="sidebar-footer">Evidence before inference</div></aside>
    <section className="workspace"><header className="topbar"><div className="topbar-title"><button className="menu-button" aria-label="Open navigation">☰</button><span className="workspace-name">Soweto Retail Universe</span></div><span className="pill ok">72% searched</span></header><div className="content">
      <div className="page-heading"><div><p className="eyebrow">Map & coverage</p><h1>See what is known — and what is not.</h1><p className="subtle">Outlet discovery never substitutes for search evidence. Unknown geography remains visible.</p></div><div className="action-row"><Link className="button" href="/dashboard">Back to overview</Link></div></div>
      <section className="panel"><div className="panel-header"><h2>Authoritative coverage view</h2><div className="action-row"><span className="pill ok">Covered</span><span className="pill warn">Partial</span><span className="pill">Outstanding</span></div></div><div className="map-stage"><div className="map-grid"/><div className="road h1"/><div className="road h2"/><div className="road v1"/><div className="road v2"/><div className="coverage covered c1"/><div className="coverage partial c2"/><div className="coverage outstanding c3"/><div className="coverage outstanding c4"/><div className="map-label zone">Opportunity cluster 03 · 74 outlets</div><div className="map-label worker">Search evidence · reconciled</div><div className="map-legend"><span><i className="legend-dot covered"/>Searched</span><span><i className="legend-dot partial"/>Partial</span><span><i className="legend-dot outstanding"/>Unknown / outstanding</span></div></div></section>
    </div></section>
  </main>;
}
