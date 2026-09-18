import Link from 'next/link';
import { Suspense } from 'react';
import StoreCaptureForm from './StoreCaptureForm';
import s from './store-capture.module.css';

export default async function NewStoreCapturePage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  const returnHref = session ? `/field/map?session=${encodeURIComponent(session)}` : '/field';
  return <main className={s.page}><div className={s.shell}><header className={s.header}><div><p>Survey Guru · Field capture</p><h1>Capture a store</h1><p>Complete the visit once, attach evidence, then send it to verification.</p></div><Link className={s.back} href={returnHref}>{session ? 'Back to map' : 'Back to Field Today'}</Link></header><Suspense fallback={<section className={s.card}>Loading authorised capture…</section>}><StoreCaptureForm /></Suspense></div></main>;
}

