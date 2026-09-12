import { detectRuntimeCapabilities } from '@survey-guru/capabilities';

export default function FieldPage() {
  const capabilities = detectRuntimeCapabilities('pwa');

  return (
    <main className="shell">
      <header className="field-header">
        <div><p className="eyebrow">Field PWA</p><h1>Today</h1></div>
        <span className="status">Prototype</span>
      </header>

      <section className="card">
        <h2>Movement Reliability Prototype</h2>
        <p>The PWA is the shared Survey Guru field experience. Android packaging adds native background movement capability when Coverage Policy requires it.</p>
      </section>

      <section className="card">
        <h2>Runtime readiness</h2>
        <dl className="readiness">
          <div><dt>PWA shell</dt><dd>Ready</dd></div>
          <div><dt>Offline shell</dt><dd>Ready for local test</dd></div>
          <div><dt>Background coverage</dt><dd>{capabilities.backgroundLocation ? 'Available' : 'Android native required'}</dd></div>
          <div><dt>Authoritative API</dt><dd>Configuration required</dd></div>
        </dl>
      </section>

      <nav className="bottom-nav" aria-label="Field navigation">
        <strong>Today</strong><span>Assignments</span><span>Map</span><span>Sync</span>
      </nav>
    </main>
  );
}
