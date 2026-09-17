'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ref, uploadBytes } from 'firebase/storage';
import { getFirebaseClientStorage } from '../../../../lib/firebase-client';
import { fieldApiOrigin, getFieldToken } from '../../map/field-api';
import s from './store-capture.module.css';

type Location = { latitude: number; longitude: number; accuracyMetres: number };
type IdentityCandidate = { storeId: string; canonicalName: string; distanceMetres: number; reason: 'SAME_LOCATION_NAME_MATCH' | 'SAME_LOCATION_NAME_CHANGED' | 'NEARBY_POSSIBLE_DUPLICATE' };
type Preflight = { allowed: boolean; reasons: { key: 'GPS_ACCURACY' | 'PROJECT_BOUNDARY' | 'IDENTITY'; message: string }[]; identityCandidates: IdentityCandidate[] };
type ProjectQuestion = { id: string; label: string; type: 'text' | 'number' | 'select'; required: boolean; options: string[]; additionalRow?: boolean };
type ProjectProduct = { brand: string; product: string; active: boolean; displayOrder: number };
type BrandRow = { id: number; brand: string; product: string };
type CaptureFormConfig = { timeZone: string; form: { templateId: 'STANDARD_FMCG' | 'CUSTOM'; questions: ProjectQuestion[]; productCatalogue: ProjectProduct[] } };
type ApiResponse = {
  storeCapture?: { id: string; workspaceId: string; projectId: string; observedName?: string; correctionReason?: string; status?: 'DRAFT' | 'SUBMITTED' | 'NEEDS_REVIEW' | 'VERIFIED' | 'READY_FOR_EXPORT'; automatedQa?: { outcome?: 'AUTO_VERIFIED' | 'MANUAL_REVIEW' } };
  preflight?: Preflight;
  message?: string;
};

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function candidateDescription(candidate: IdentityCandidate): string {
  if (candidate.reason === 'SAME_LOCATION_NAME_CHANGED') return `Same location · name may have changed · ${candidate.distanceMetres} m away`;
  if (candidate.reason === 'SAME_LOCATION_NAME_MATCH') return `Likely the same store · ${candidate.distanceMetres} m away`;
  return `Possible nearby duplicate · ${candidate.distanceMetres} m away`;
}

function parsePrice(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim().replace(/^R\s*/i, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(raw)) return null;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalSeparator = lastComma >= 0 && lastDot >= 0
    ? lastComma > lastDot ? ',' : '.'
    : lastComma >= 0
      ? raw.length - lastComma - 1 <= 2 ? ',' : null
      : lastDot >= 0 && raw.length - lastDot - 1 <= 2 ? '.' : null;
  const decimalIndex = decimalSeparator ? raw.lastIndexOf(decimalSeparator) : -1;
  const integerPart = (decimalIndex >= 0 ? raw.slice(0, decimalIndex) : raw).replace(/[.,]/g, '');
  const fractionPart = decimalIndex >= 0 ? raw.slice(decimalIndex + 1) : '';
  const normalised = fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalised)) return null;
  const price = Number(normalised);
  return Number.isFinite(price) && price >= 0 ? price : null;
}

export default function StoreCaptureForm() {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignment');
  const sessionId = searchParams.get('session');
  const returnedCaptureId = searchParams.get('capture');
  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [selectedExistingStoreId, setSelectedExistingStoreId] = useState<string | null>(null);
  const [confirmedNewStore, setConfirmedNewStore] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [draft, setDraft] = useState<{ id: string; workspaceId: string; projectId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [receipt, setReceipt] = useState<{ captureId: string; status: string; automatedOutcome: string } | null>(null);
  const [formConfig, setFormConfig] = useState<CaptureFormConfig>({ timeZone: 'Africa/Johannesburg', form: { templateId: 'STANDARD_FMCG', questions: [], productCatalogue: [] } });
  const [brandRows, setBrandRows] = useState<BrandRow[]>([{ id: 1, brand: '', product: '' }]);
  const [additionalRows, setAdditionalRows] = useState<number[]>([1]);
  const locationPromptRequested = useRef(false);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getFieldToken();
        const response = await fetch(`${fieldApiOrigin()}/api/v1/assignments/${encodeURIComponent(assignmentId)}/store-capture-form`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const result = await response.json() as CaptureFormConfig & { message?: string };
        if (!response.ok || !result.form) throw new Error(result.message ?? 'The project questionnaire could not be loaded.');
        if (!cancelled) setFormConfig(result);
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'The project questionnaire could not be loaded.'); }
    })();
    return () => { cancelled = true; };
  }, [assignmentId]);

  useEffect(() => {
    if (locationPromptRequested.current) return;
    locationPromptRequested.current = true;
    if (!window.isSecureContext) {
      setMessage('Location permission requires a secure HTTPS connection on this phone.');
      return;
    }
    locate();
  }, []);

  useEffect(() => {
    if (!returnedCaptureId) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getFieldToken();
        const response = await fetch(`${fieldApiOrigin()}/api/v1/store-captures/${encodeURIComponent(returnedCaptureId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const result = await response.json() as ApiResponse;
        if (!response.ok || !result.storeCapture || result.storeCapture.status !== 'NEEDS_REVIEW') throw new Error(result.message ?? 'The returned capture is no longer available for correction.');
        if (!cancelled) {
          setDraft({ id: result.storeCapture.id, workspaceId: result.storeCapture.workspaceId, projectId: result.storeCapture.projectId });
          setStoreName(result.storeCapture.observedName ?? '');
          setPhoto(null);
          setMessage(`Returned by QA: ${result.storeCapture.correctionReason ?? 'Replace the evidence and submit the store again.'}`);
        }
      } catch (error) { if (!cancelled) setMessage(error instanceof Error ? error.message : 'The returned capture could not be opened.'); }
    })();
    return () => { cancelled = true; };
  }, [returnedCaptureId]);

  function locate() {
    if (!navigator.geolocation) return setMessage('Location is not available in this browser.');
    setBusy(true);
    setPreflight(null);
    setSelectedExistingStoreId(null);
    setConfirmedNewStore(false);
    setMessage('Checking your current location…');
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMetres: position.coords.accuracy });
      setMessage(`Location found · accuracy ±${Math.round(position.coords.accuracy)} m. Check eligibility before continuing.`);
      setBusy(false);
    }, (error) => { setMessage(error.message || 'Location could not be read.'); setBusy(false); }, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 });
  }

  async function request(path: string, method: 'POST' | 'PATCH', body?: unknown): Promise<ApiResponse> {
    const token = await getFieldToken();
    const response = await fetch(`${fieldApiOrigin()}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json() as ApiResponse;
    if (!response.ok) throw new Error(result.message ?? 'The store capture could not be saved.');
    return result;
  }

  async function checkPreflight() {
    if (!assignmentId) return setMessage('Open store capture from an authorised assignment.');
    if (!storeName.trim()) return setMessage('Enter the store name first.');
    if (!location) return setMessage('Use the current store location first.');
    setBusy(true);
    setMessage('Checking project area, GPS quality and existing stores…');
    try {
      const result = await request(`/api/v1/assignments/${encodeURIComponent(assignmentId)}/store-captures/preflight`, 'POST', {
        observedName: storeName.trim(), ...location, ...(selectedExistingStoreId ? { selectedExistingStoreId } : {}), ...(confirmedNewStore ? { confirmedNewStore: true } : {}),
      });
      if (!result.preflight) throw new Error('The eligibility check was not returned by the server.');
      setPreflight(result.preflight);
      setMessage(result.preflight.allowed
        ? '✓ Location and store identity confirmed. Complete the questionnaire below.'
        : result.preflight.reasons.map((reason) => reason.message).join(' '));
    } catch (cause) {
      setPreflight(null);
      setMessage(cause instanceof Error ? cause.message : 'The store eligibility check failed.');
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentId) return setMessage('Open store capture from an authorised assignment.');
    if (!location || !preflight?.allowed) return setMessage('Pass the location and identity check before saving.');
    if (!photo) return setMessage('Take or choose a storefront photo before saving.');
    const form = new FormData(event.currentTarget);
    const brandProducts = formConfig.form.templateId === 'STANDARD_FMCG' ? brandRows.map((row) => {
      const purchasePrice = parsePrice(form.get(`purchasePrice-${row.id}`));
      const sellingPrice = parsePrice(form.get(`sellingPrice-${row.id}`));
      return { brand: row.brand || String(form.get(`brand-${row.id}`) ?? '').trim(), product: row.product || String(form.get(`product-${row.id}`) ?? '').trim(), purchasePrice, sellingPrice, dailySalesVolume: Number(form.get(`dailySalesVolume-${row.id}`)) };
    }) : [];
    if (brandProducts.some((item) => !item.brand || !item.product || item.purchasePrice === null || item.sellingPrice === null || !Number.isFinite(item.dailySalesVolume) || item.dailySalesVolume < 0)) return setMessage('Complete every brand row with valid purchase price, selling price and daily sales volume.');
    const customAnswers = Object.fromEntries(formConfig.form.questions.map((question) => {
      if (question.additionalRow) {
        const values = additionalRows.map((rowId) => String(form.get(`${question.id}-${rowId}`) ?? '').trim());
        return [question.id, question.type === 'number' ? values.map((value) => value ? parsePrice(value) : '') : values];
      }
      const raw = String(form.get(question.id) ?? '').trim();
      if (question.type !== 'number') return [question.id, raw];
      if (!raw) return [question.id, ''];
      return [question.id, parsePrice(raw)];
    }));
    const invalidNumberQuestion = formConfig.form.questions.find((question) => question.type === 'number' && (question.additionalRow ? (customAnswers[question.id] as unknown[]).some((value) => value === null) : String(form.get(question.id) ?? '').trim() && customAnswers[question.id] === null));
    if (invalidNumberQuestion) return setMessage(`${invalidNumberQuestion.label} must be a valid number. You may use a comma or full stop for decimals.`);
    const answers = { ...(formConfig.form.templateId === 'STANDARD_FMCG' ? { ownerName: String(form.get('ownerName') ?? '').trim(), brandProducts } : {}), ...customAnswers };
    const baseBody = { observedName: storeName.trim(), ...location, ...(selectedExistingStoreId ? { selectedExistingStoreId } : {}), ...(confirmedNewStore ? { confirmedNewStore: true } : {}), answers, photos: [] };
    setBusy(true);
    setMessage('Saving the eligible capture…');
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
      setMessage('Running final automated checks…');
      await request(`/api/v1/store-captures/${encodeURIComponent(activeDraft.id)}`, 'PATCH', { ...baseBody, photos });
      const submitted = await request(`/api/v1/store-captures/${encodeURIComponent(activeDraft.id)}/submit`, 'POST');
      const submittedCapture = submitted.storeCapture;
      const automatedOutcome = submittedCapture?.automatedQa?.outcome ?? 'MANUAL_REVIEW';
      setReceipt({ captureId: activeDraft.id, status: submittedCapture?.status ?? 'SUBMITTED', automatedOutcome });
      setComplete(true);
      setMessage(submittedCapture?.status === 'READY_FOR_EXPORT'
        ? 'All automated checks passed. The store is ready in the Premier integration queue.'
        : 'An exceptional issue remains and has been sent to human QA.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The store capture could not be saved.');
    } finally { setBusy(false); }
  }

  if (complete) return <section className={s.success} role="status"><span>✓</span><div><h2>{receipt?.status === 'READY_FOR_EXPORT' ? 'Store captured successfully' : 'Store exception sent to QA'}</h2><p>{message}</p>{receipt ? <p><strong>Capture reference:</strong> {receipt.captureId}<br/><strong>Current state:</strong> {receipt.status === 'READY_FOR_EXPORT' ? 'Ready for Premier integration' : 'Human exception review required'}</p> : null}<p>The capturer can continue working immediately.</p><Link href={`/field/map${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''}`}>Return to the coverage map</Link></div></section>;

  return <form className={s.form} onSubmit={submit}>
    <section className={s.card}>
      <p className={s.eyebrow}>{returnedCaptureId ? '1 · Redo the store returned by QA' : '1 · Confirm this store can be captured'}</p>
      <label>Store name<input name="storeName" required autoComplete="organization" placeholder="Name shown at the store" value={storeName} onChange={(event) => { setStoreName(event.target.value); setPreflight(null); setSelectedExistingStoreId(null); setConfirmedNewStore(false); }} /></label>
      <button className={s.secondary} type="button" onClick={locate} disabled={busy}>{location ? 'Refresh store location' : 'Use current store location'}</button>
      {location ? <p className={s.ready}>Location found · ±{Math.round(location.accuracyMetres)} m</p> : null}
      {preflight?.identityCandidates.length ? <div className={s.candidates}><strong>Stores found nearby</strong><p>Select the same physical outlet even if its name changed, or confirm that the outlet you are standing at is separate.</p>{preflight.identityCandidates.map((candidate) => <button className={candidate.storeId === selectedExistingStoreId ? s.candidateSelected : ''} type="button" key={candidate.storeId} onClick={() => { setSelectedExistingStoreId(candidate.storeId); setConfirmedNewStore(false); setMessage('Existing store selected. Check eligibility again to continue.'); }}><b>{candidate.canonicalName}</b><span>{candidateDescription(candidate)}</span></button>)}<button className={confirmedNewStore ? s.candidateSelected : s.newStoreChoice} type="button" onClick={() => { setSelectedExistingStoreId(null); setConfirmedNewStore(true); setMessage('Separate new store confirmed. Check eligibility again to continue.'); }}><b>None of these — capture as a new store</b><span>Use this only when this is a different physical outlet.</span></button></div> : null}
      <button className={s.preflight} type="button" onClick={() => void checkPreflight()} disabled={busy || !location || !storeName.trim()}>{busy ? 'Checking…' : selectedExistingStoreId ? 'Confirm selected store and continue' : confirmedNewStore ? 'Confirm separate new store and continue' : 'Check location and existing stores'}</button>
      {message ? <p className={preflight?.allowed ? s.ready : s.message} role="status">{message}</p> : null}
    </section>

    {preflight?.allowed ? <>
          <section className={s.card}><p className={s.eyebrow}>2 · {formConfig.form.templateId === 'STANDARD_FMCG' ? 'Store details and daily sales' : 'Project questionnaire'}</p><p className={s.timeZone}>Times for this project use {formConfig.timeZone}.</p>{formConfig.form.templateId === 'STANDARD_FMCG' ? <><label>Owner or contact name<input name="ownerName" required autoComplete="name" placeholder="Person spoken to" /></label><div className={s.brandRows}>{brandRows.map((row, index) => { const catalogue = formConfig.form.productCatalogue ?? []; const brands = [...new Set(catalogue.map((item) => item.brand))]; const selectedElsewhere = new Set(brandRows.filter((item) => item.id !== row.id).map((item) => `${item.brand}\u0000${item.product}`)); const products = catalogue.filter((item) => item.brand === row.brand && !selectedElsewhere.has(`${item.brand}\u0000${item.product}`)); return <fieldset className={s.brandRow} key={row.id}><legend>Product {index + 1}</legend>{catalogue.length ? <><label>Brand<select name={`brand-${row.id}`} required value={row.brand} onChange={(event) => setBrandRows((current) => current.map((item) => item.id === row.id ? { ...item, brand: event.target.value, product: '' } : item))}><option value="">Select brand</option>{brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}</select></label><label>Product<select name={`product-${row.id}`} required value={row.product} disabled={!row.brand} onChange={(event) => setBrandRows((current) => current.map((item) => item.id === row.id ? { ...item, product: event.target.value } : item))}><option value="">Select product</option>{products.map((item) => <option key={item.product} value={item.product}>{item.product}</option>)}</select></label></> : <><label>Brand<input name={`brand-${row.id}`} required placeholder="Brand name" /></label><label>Product<input name={`product-${row.id}`} required placeholder="Product or pack size" /></label></>}<div className={s.priceGrid}><label>Purchase price<input name={`purchasePrice-${row.id}`} required type="text" inputMode="decimal" placeholder="R 2 000,45" /></label><label>Selling price<input name={`sellingPrice-${row.id}`} required type="text" inputMode="decimal" placeholder="R 2 200,45" /></label></div><label>Daily sales volume<input name={`dailySalesVolume-${row.id}`} required type="number" min="0" step="1" inputMode="numeric" placeholder="Units sold per day" /></label>{brandRows.length > 1 ? <button className={s.removeBrand} type="button" onClick={() => setBrandRows((current) => current.filter((item) => item.id !== row.id))}>Remove product</button> : null}</fieldset>; })}</div><button className={s.secondary} type="button" onClick={() => setBrandRows((current) => [...current, { id: Math.max(...current.map((item) => item.id)) + 1, brand: '', product: '' }])}>＋ Add another product</button></> : null}{formConfig.form.questions.filter((question) => !question.additionalRow).map((question) => <label key={question.id}>{question.label}{question.type === 'select' ? <select name={question.id} required={question.required}><option value="">Select an option</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input name={question.id} required={question.required} type="text" inputMode={question.type === 'number' ? 'decimal' : undefined} placeholder={question.type === 'number' ? 'Use comma or full stop for decimals' : undefined} />}</label>)}{formConfig.form.questions.some((question) => question.additionalRow) ? <div className={s.brandRows}>{additionalRows.map((rowId, rowIndex) => <fieldset className={s.brandRow} key={rowId}><legend>Product sales {rowIndex + 1}</legend>{formConfig.form.questions.filter((question) => question.additionalRow).map((question) => <label key={question.id}>{question.label}{question.type === 'select' ? <select name={`${question.id}-${rowId}`} required={question.required}><option value="">Select an option</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input name={`${question.id}-${rowId}`} required={question.required} type="text" inputMode={question.type === 'number' ? 'decimal' : undefined} placeholder={question.type === 'number' ? 'Use comma or full stop for decimals' : undefined}/>}</label>)}{additionalRows.length > 1 ? <button className={s.removeBrand} type="button" onClick={() => setAdditionalRows((current) => current.filter((id) => id !== rowId))}>Remove product</button> : null}</fieldset>)}</div> : null}{formConfig.form.questions.some((question) => question.additionalRow) ? <button className={s.secondary} type="button" onClick={() => setAdditionalRows((current) => [...current, Math.max(...current) + 1])}>＋ Add product</button> : null}</section>
      <section className={s.card}><p className={s.eyebrow}>3 · Storefront evidence</p><label>Storefront photo<input required type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></label>{photo ? <p className={s.ready}>✓ {photo.name}</p> : null}</section>
      <section className={s.submit}><button type="submit" disabled={busy}>{busy ? 'Saving securely…' : 'Complete store capture'}</button><p>Clean captures proceed automatically to the Premier integration queue. Only exceptional issues are sent to human QA.</p>{message ? <p className={s.message} role="status">{message}</p> : null}</section>
    </> : null}
  </form>;
}
