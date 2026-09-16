import Link from 'next/link';
import { Suspense } from 'react';
import StoreCaptureForm from './StoreCaptureForm';
import s from './store-capture.module.css';

export default function NewStoreCapturePage() {
  return <main className={s.page}><div className={s.shell}><header className={s.header}><div><p>Survey Guru · Field capture</p><h1>Capture a store</h1><p>Complete the visit once, attach evidence, then send it to verification.</p></div><Link className={s.back} href="/field/map">Back to map</Link></header><Suspense fallback={<section className={s.card}>Loading authorised capture…</section>}><StoreCaptureForm /></Suspense></div></main>;
}

