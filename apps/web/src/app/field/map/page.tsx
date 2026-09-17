import Link from 'next/link';
import { Suspense } from 'react';
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
      <Suspense fallback={<section className={s.policy}><div><span>Persisted Store Coverage Search</span><strong>Loading authorised session…</strong></div></section>}><AuthorisedSearchSession /></Suspense>
      <section className={s.policy}><div><span>Coverage policy</span><strong>{capabilities.backgroundLocation ? 'Background movement available' : 'Foreground PWA · Android for reliable background movement'}</strong></div><div><span>GPS</span><strong>Good</strong></div><div><span>Sync queue</span><strong>Session-backed above</strong></div></section>
      <section className={s.action}><p className={s.eyebrow}>Next best action · Coverage evidence</p><h2>Search the assigned geography</h2><p>The shared map paints only server-reconciled project streets. Confirmed walked intervals are green, their unwalked remainder stays red, and amber is reserved for uncertain evidence. One capturer’s accepted coverage is visible to every authorised user on the project.</p><div className={s.actionRow}><button className={s.primary}>Resume search</button><Link className={s.secondary} href="/field">Back to Today</Link></div></section>
      <section className={s.action} aria-label="Coverage evidence handoff"><p className={s.eyebrow}>Server-owned evidence</p><h2>Uncertain matches stay outstanding</h2><p>Parallel-street ambiguity and no-match outcomes remain visible for review but contribute zero completed coverage. The field worker never marks a street verified.</p><div className={s.actionRow}><span className={s.secondary}>QA handoff follows verified evidence</span></div></section>
      <nav className={s.nav} aria-label="Field navigation"><Link href="/field">Field Today</Link><Link className={s.active} href="/field/map">Field Live Map</Link></nav>
    </div></section>
  </div></main>;
}
