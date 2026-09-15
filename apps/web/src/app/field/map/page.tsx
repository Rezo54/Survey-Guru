import Link from 'next/link';
import { detectRuntimeCapabilities } from '@survey-guru/capabilities';
import SurveyGuruSidebar from '../../../components/SurveyGuruSidebar';
import AuthorisedSearchSession from './AuthorisedSearchSession';
import s from './field-map.module.css';

export default function FieldMapPage() {
  const capabilities = detectRuntimeCapabilities('pwa');
  return <main className={s.page}><div className={s.shell}>
    <SurveyGuruSidebar active="field-map" />
    <section className={s.main}><div className={s.workspace}>
      <header className={s.header}><div><p className={s.eyebrow}>Survey Guru · Field intelligence</p><h1 className={s.title}>Search what remains</h1><p className={s.subtle}>Your map is the work surface. Search evidence becomes authoritative only after reconciliation.</p></div><span className={s.status}>● Offline ready</span></header>
      <AuthorisedSearchSession />
      <section className={s.policy}><div><span>Coverage policy</span><strong>{capabilities.backgroundLocation ? 'Background movement available' : 'Foreground PWA · Android for reliable background movement'}</strong></div><div><span>GPS</span><strong>Good</strong></div><div><span>Sync queue</span><strong>Session-backed above</strong></div></section>
      <section className={s.map} aria-label="Representative field coverage map"><div className={s.grid}/><div className={`${s.road} ${s.h1}`}/><div className={`${s.road} ${s.h2}`}/><div className={`${s.road} ${s.v1}`}/><div className={`${s.road} ${s.v2}`}/><div className={s.covered}/><div className={s.partial}/><div className={s.outstanding}/><div className={`${s.zone} ${s.zoneOne}`}/><div className={`${s.zone} ${s.zoneTwo}`}/><div className={s.toolbar}><span className={s.chip}>● Authorised session</span><span className={s.chip}>Dobsonville West · Unknown → Searched</span></div><div className={s.worker}>You · recording search evidence</div><div className={s.callout}><strong>Session</strong><span>coverage metrics are persisted above</span></div><button className={s.fab}>＋ Add outlet</button></section>
      <section className={s.action}><p className={s.eyebrow}>Next best action · Coverage evidence</p><h2>Search the assigned geography</h2><p>The persisted session starts conservatively: unknown geography remains unknown until actual search evidence is captured. Finding an outlet does not prove the surrounding geography was searched.</p><div className={s.actionRow}><button className={s.primary}>Resume search</button><Link className={s.secondary} href="/projects/demo/map">View project coverage</Link><Link className={s.secondary} href="/field">Back to Today</Link></div></section>
      <section className={s.action} aria-label="Demo evidence handoff"><p className={s.eyebrow}>Future checkpoint · Search evidence captured</p><h2>Reconciliation follows evidence capture</h2><p>We will only enable the QA handoff once real session evidence exists. The field worker never marks coverage verified.</p><div className={s.actionRow}><span className={s.secondary}>QA handoff not yet live</span></div></section>
      <nav className={s.nav} aria-label="Field navigation"><Link href="/field">Today</Link><span>Assignments</span><Link className={s.active} href="/field/map">Map</Link><span>Sync</span></nav>
    </div></section>
  </div></main>;
}
