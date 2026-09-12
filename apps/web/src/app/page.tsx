import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-card">
        <p className="eyebrow">TES — Task Expert Systems</p>
        <h1>Survey Guru</h1>
        <p className="subtle">Discover. Survey. Validate. Map. Analyse.</p>
        <p><span className="kicker">Hybrid Enterprise/GIS</span> — geographic intelligence stays at the centre of the operating experience.</p>
        <div className="home-actions">
          <Link className="button primary" href="/dashboard">Open Management</Link>
          <Link className="button" href="/field">Open Field PWA</Link>
          <Link className="button" href="/field/map">Open Field Map</Link>
        </div>
        <div className="design-note">This checkpoint is deliberately configuration-safe: Firebase and protected API operations remain injected later. The screens use representative local data to validate structure, hierarchy and field usability first.</div>
      </section>
    </main>
  );
}
