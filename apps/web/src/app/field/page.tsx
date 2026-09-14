import Link from 'next/link';
import { detectRuntimeCapabilities } from '@survey-guru/capabilities';

const assignments = [
  ['Dobsonville West', 'Coverage search', '08:00–10:30', 'Priority'],
  ['Meadowlands', 'Outlet verification', '11:00–12:30', 'Ready'],
  ['Orlando East', 'Opportunity validation', '13:30–15:30', 'Ready'],
];

export default function FieldPage() {
  const capabilities = detectRuntimeCapabilities('pwa');

  return (
    <main className="field-shell field-today">
      <header className="field-header">
        <div><p className="eyebrow">Survey Guru · Field</p><h1>Today</h1><p className="subtle">Search deliberately. Capture evidence. Leave no geography ambiguous.</p></div>
        <span className="status">Offline ready</span>
      </header>

      <section className="field-hero">
        <div><span className="field-hero-label">Today&apos;s assignment</span><h2>Dobsonville West</h2><p>Close the remaining search gap before moving to outlet verification.</p></div>
        <div className="field-hero-stat"><strong>18.6</strong><span>km remaining</span></div>
        <Link className="button field-cta" href="/field/map">Open live map →</Link>
      </section>

      <section className="coverage-summary field-summary">
        <div><strong>4.8 km</strong><span>Searched today</span></div>
        <div><strong>12</strong><span>Outlets verified</span></div>
        <div><strong>3</strong><span>Queued offline</span></div>
      </section>

      <section className="field-card">
        <div className="panel-header field-card-header"><div><p className="eyebrow">Work queue</p><h2>Assignments</h2></div><span className="pill ok">3 active</span></div>
        <div className="assignment-list">{assignments.map(([place,type,time,state], index) => <article className="assignment" key={place}><div className="assignment-order">{index + 1}</div><div><strong>{place}</strong><span>{type} · {time}</span></div><em className={state === 'Priority' ? 'priority' : ''}>{state}</em></article>)}</div>
      </section>

      <section className="field-card field-readiness">
        <div className="panel-header field-card-header"><div><p className="eyebrow">Device & evidence</p><h2>Ready to work</h2></div></div>
        <dl className="readiness">
          <div><dt>PWA & offline shell</dt><dd>Ready</dd></div>
          <div><dt>Foreground search</dt><dd>Available</dd></div>
          <div><dt>Background coverage</dt><dd>{capabilities.backgroundLocation ? 'Available' : 'Android required'}</dd></div>
          <div><dt>Protected business API</dt><dd>Awaiting dev auth</dd></div>
        </dl>
      </section>

      <nav className="bottom-nav" aria-label="Field navigation">
        <Link className="active" href="/field">Today</Link><span>Assignments</span><Link href="/field/map">Map</Link><span>Sync</span>
      </nav>
    </main>
  );
}
