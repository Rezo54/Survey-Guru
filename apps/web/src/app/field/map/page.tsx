import Link from 'next/link';
import { detectRuntimeCapabilities } from '@survey-guru/capabilities';

export default function FieldMapPage() {
  const capabilities = detectRuntimeCapabilities('pwa');
  return <main className="field-shell">
    <header className="field-header"><div><p className="eyebrow">Field PWA · Live map</p><h1>Search what remains</h1></div><span className="status">Offline ready</span></header>
    <section className="field-card"><strong>Coverage policy</strong><p>{capabilities.backgroundLocation ? 'Background movement available.' : 'PWA foreground search is available; Android native capability is required when policy mandates reliable background movement.'}</p></section>
    <section className="field-map" aria-label="Representative live field coverage map"><div className="map-grid"/><div className="road h1"/><div className="road h2"/><div className="road v1"/><div className="road v2"/><div className="coverage covered c1"/><div className="coverage partial c2"/><div className="coverage outstanding c3"/><div className="map-toolbar"><span>GPS · Good</span><span>Queued · 3</span></div><div className="map-label worker">You · search active</div><button className="fab">Add outlet</button></section>
    <section className="coverage-summary"><div><strong>4.8 km</strong><span>Searched today</span></div><div><strong>1.3 km</strong><span>Partial</span></div><div><strong>3.1 km</strong><span>Remaining</span></div></section>
    <nav className="bottom-nav" aria-label="Field navigation"><Link href="/field">Today</Link><Link href="/field">Assignments</Link><Link className="active" href="/field/map">Map</Link><Link href="/field">Sync</Link></nav>
  </main>;
}
