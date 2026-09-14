import Link from 'next/link';
import { detectRuntimeCapabilities } from '@survey-guru/capabilities';
import s from './field-map.module.css';

export default function FieldMapPage() {
  const capabilities = detectRuntimeCapabilities('pwa');
  return <main className={s.page}>
    <header className={s.header}><div><p className={s.eyebrow}>Survey Guru · Field intelligence</p><h1 className={s.title}>Search what remains</h1><p className={s.subtle}>Your map is the work surface. Search evidence becomes authoritative only after reconciliation.</p></div><span className={s.status}>● Offline ready</span></header>
    <section className={s.policy}><div><span>Coverage policy</span><strong>{capabilities.backgroundLocation ? 'Background movement available' : 'Foreground PWA · Android for reliable background movement'}</strong></div><div><span>GPS</span><strong>Good</strong></div><div><span>Sync queue</span><strong>3 records</strong></div></section>
    <section className={s.map} aria-label="Representative live field coverage map">
      <div className={s.grid}/><div className={`${s.road} ${s.h1}`}/><div className={`${s.road} ${s.h2}`}/><div className={`${s.road} ${s.v1}`}/><div className={`${s.road} ${s.v2}`}/><div className={s.covered}/><div className={s.partial}/><div className={s.outstanding}/><div className={`${s.zone} ${s.zoneOne}`}/><div className={`${s.zone} ${s.zoneTwo}`}/>
      <div className={s.toolbar}><span className={s.chip}>● Search active</span><span className={s.chip}>Dobsonville West</span></div><div className={s.worker}>You · evidence recording</div><div className={s.callout}><strong>3.1 km</strong><span>still needs search evidence</span></div><button className={s.fab}>＋ Add outlet</button>
    </section>
    <section className={s.summary}><div><strong>4.8 km</strong><span>Searched today</span></div><div><strong>1.3 km</strong><span>Partial</span></div><div><strong>3.1 km</strong><span>Remaining</span></div></section>
    <section className={s.action}><p className={s.eyebrow}>Next best action</p><h2>Finish the western pocket</h2><p>Complete the outstanding streets before verifying the nearby opportunity cluster. Discovery must not substitute for search evidence.</p><div className={s.actionRow}><button className={s.primary}>Resume search</button><Link className={s.secondary} href="/field">Back to Today</Link></div></section>
    <nav className={s.nav} aria-label="Field navigation"><Link href="/field">Today</Link><span>Assignments</span><Link className={s.active} href="/field/map">Map</Link><span>Sync</span></nav>
  </main>;
}
