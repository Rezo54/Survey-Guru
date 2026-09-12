import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">TES — Task Expert Systems</p>
        <h1>Survey Guru</h1>
        <p className="lede">Discover. Survey. Validate. Map. Analyse.</p>
        <div className="actions">
          <Link className="primary" href="/field">Open Field PWA</Link>
        </div>
      </section>
      <section className="card-grid">
        <article className="card"><strong>Management</strong><span>Projects, QA, coverage and reporting will live here.</span></article>
        <article className="card"><strong>Field</strong><span>The first implementation checkpoint focuses on offline-ready field execution.</span></article>
        <article className="card"><strong>Authority</strong><span>All protected business operations go through the Survey Guru API.</span></article>
      </section>
    </main>
  );
}
