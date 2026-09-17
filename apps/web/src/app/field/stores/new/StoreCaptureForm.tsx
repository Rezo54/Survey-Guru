'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { getFirebaseClientStorage } from '../../../../lib/firebase-client';
import { fieldApiOrigin, getFieldToken } from '../../map/field-api';
import s from './store-capture.module.css';

type Location = { latitude: number; longitude: number; accuracyMetres: number };
type DraftResponse = {
  storeCapture?: {
    id: string;
    workspaceId: string;
    projectId: string;
    status?: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'READY_FOR_EXPORT';
    automatedQa?: { outcome?: 'AUTO_VERIFIED' | 'MANUAL_REVIEW' };
  };
  message?: string;
};

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export default function StoreCaptureForm() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignment');
  const sessionId = searchParams.get('session');
  const [location, setLocation] = useState<Location | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [draft, setDraft] = useState<{ id: string; workspaceId: string; projectId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [receipt, setReceipt] = useState<{ captureId: string; status: string; automatedOutcome: string } | null>(null);

  function locate() {
    if (!navigator.geolocation) return setMessage('Location is not available in this browser.');
    setBusy(true);
    setMessage('Checking your current location…');
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMetres: position.coords.accuracy });
      setMessage(`Location ready · accuracy ±${Math.round(position.coords.accuracy)} m`);
      setBusy(false);
    }, (error) => { setMessage(error.message || 'Location could not be read.'); setBusy(false); }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
  }

  async function request(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<DraftResponse> {
    const token = await getFieldToken();
    const response = await fetch(`${fieldApiOrigin()}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json() as DraftResponse;
    if (!response.ok) throw new Error(result.message ?? 'The store capture could not be saved.');
    return result;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentId) return setMessage('Open store capture from an authorised assignment.');
    if (!location) return setMessage('Confirm the store location before saving.');
    if (!photo) return setMessage('Take or choose a storefront photo before saving.');
    const form = new FormData(event.currentTarget);
    const observedName = String(form.get('storeName') ?? '').trim();
    const ownerName = String(form.get('ownerName') ?? '').trim();
    const stockedBrands = String(form.get('brands') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const product = String(form.get('product') ?? '').trim();
    const price = Number(form.get('price'));
    const monthlyVolume = Number(form.get('monthlyVolume'));
    const answers = { ownerName, stockedBrands, pricing: [{ product, price }], monthlyVolume };
    const baseBody = { observedName, ...location, answers, photos: [] };
    setBusy(true);
    setMessage('Saving draft…');
    try {
      let activeDraft = draft;
      if (!activeDraft) {
        const created = await request(`/api/v1/assignments/${encodeURIComponent(assignmentId)}/store-captures`, 'POST', baseBody);
        if (!created.storeCapture) throw new Error('The store draft was not returned by the server.');
        activeDraft = created.storeCapture;
        setDraft(activeDraft);
      }
      const storage = getFirebaseClientStorage();
      if (!storage) throw new Error('Photo storage is not configured for this build.');
      const digest = await sha256(photo);
      const extension = photo.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
      const storageObjectPath = `workspaces/${activeDraft.workspaceId}/projects/${activeDraft.projectId}/captures/${activeDraft.id}/storefront.${extension}`;
      setMessage('Uploading storefront photo…');
      await uploadBytes(ref(storage, storageObjectPath), photo, { contentType: photo.type || 'image/jpeg', customMetadata: { sha256: digest } });
      const photos = [{ storageObjectPath, sha256: digest, capturedAt: new Date().toISOString() }];
      setMessage('Submitting for verification…');
      await request(`/api/v1/store-captures/${encodeURIComponent(activeDraft.id)}`, 'PATCH', { ...baseBody, photos });
      const submitted = await request(`/api/v1/store-captures/${encodeURIComponent(activeDraft.id)}/submit`, 'POST');
      const submittedCapture = submitted.storeCapture;
      const automatedOutcome = submittedCapture?.automatedQa?.outcome ?? 'MANUAL_REVIEW';
      setReceipt({ captureId: activeDraft.id, status: submittedCapture?.status ?? 'SUBMITTED', automatedOutcome });
      setComplete(true);
      setMessage(automatedOutcome === 'AUTO_VERIFIED'
        ? 'Automated checks passed. A supervisor must still give final export approval.'
        : 'Store sent to human QA because one or more automated checks require review.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The store capture could not be saved.');
    } finally { setBusy(false); }
  }

  if (complete) return <section className={s.success} role="status"><span>✓</span><div><h2>Store submitted to QA</h2><p>{message}</p>{receipt ? <p><strong>Capture reference:</strong> {receipt.captureId}<br/><strong>Current state:</strong> {receipt.status === 'VERIFIED' ? 'Automated verification passed · supervisor approval pending' : 'Human QA review required'}</p> : null}<p>The capturer can continue working. An authorised supervisor reviews this record from the QA page.</p><Link href={`/field/map${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''}`}>Return to the coverage map</Link></div></section>;

  return <form className={s.form} onSubmit={submit}>
    <section className={s.card}><p className={s.eyebrow}>1 · Identify the outlet</p><label>Store name<input name="storeName" required autoComplete="organization" placeholder="Name shown at the store" /></label><label>Owner or contact name<input name="ownerName" required autoComplete="name" placeholder="Person spoken to" /></label><p className={s.hint}>If the name has changed, the server can still present same-location stores for identity review without overwriting their history.</p></section>
    <section className={s.card}><p className={s.eyebrow}>2 · Record what is sold</p><label>Brands stocked<input name="brands" required placeholder="Brand A, Brand B" /></label><div className={s.grid}><label>Product<input name="product" required placeholder="Bread" /></label><label>Price<input name="price" required type="number" min="0" step="0.01" inputMode="decimal" placeholder="18.50" /></label></div><label>Estimated monthly volume<input name="monthlyVolume" required type="number" min="0" step="1" inputMode="numeric" placeholder="Units per month" /></label></section>
    <section className={s.card}><p className={s.eyebrow}>3 · Evidence</p><button className={s.secondary} type="button" onClick={locate} disabled={busy}>{location ? 'Refresh store location' : 'Use current store location'}</button>{location ? <p className={s.ready}>✓ Location ready · ±{Math.round(location.accuracyMetres)} m</p> : null}<label>Storefront photo<input required type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>{photo ? <p className={s.ready}>✓ {photo.name}</p> : null}</section>
    <section className={s.submit}><button type="submit" disabled={busy}>{busy ? 'Saving securely…' : 'Submit store for verification'}</button><p>Submission goes to QA first. Third-party export remains blocked until the record is verified and marked ready.</p>{message ? <p className={s.message} role="status">{message}</p> : null}</section>
  </form>;
}
