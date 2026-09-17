'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import SurveyGuruSidebar from '../../../components/SurveyGuruSidebar';
import { darkRoadmapStyle, loadGoogleMaps } from '../../../components/ProjectCoverageMap';
import { fieldApiOrigin, getFieldToken } from '../../field/map/field-api';
import styles from './project-setup.module.css';
import accessStyles from './admin-access.module.css';
import questionStyles from './questionnaire-builder.module.css';

type Coordinate = { latitude: number; longitude: number };
type ProjectQuestion = { id: string; label: string; type: 'text' | 'number' | 'select'; required: boolean; options: string[] };
type PublishResult = {
  project: { id: string; name: string; boundaryAreaSquareKm: number };
  assignment: { id: string; areaName: string };
  searchSession: { id: string; state: string };
  links: { fieldMap: string; projectMap?: string };
};
type AssignmentOptions = {
  projects: Array<{ id: string; name: string; boundaryAreaSquareKm: number | null; publishedAt: string | null }>;
  capturers: Array<{ id: string; email: string; roleKey: string; roleName: string }>;
};
type AssignmentResult = { project: { id: string; name: string }; capturer: { id: string; email: string }; assignment: { id: string; areaName: string }; searchSession: { id: string; state: string }; links: { fieldMap: string } };

export default function NewProjectPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const searchControlRef = useRef<HTMLDivElement | null>(null);
  const placeListenerRef = useRef<any>(null);
  const [name, setName] = useState('Local Store Capture Test');
  const [areaName, setAreaName] = useState('Test capture area');
  const [timeZone, setTimeZone] = useState('Africa/Johannesburg');
  const [formTemplateId, setFormTemplateId] = useState<'STANDARD_FMCG' | 'CUSTOM'>('STANDARD_FMCG');
  const [questions, setQuestions] = useState<ProjectQuestion[]>([]);
  const [boundary, setBoundary] = useState<Coordinate[]>([]);
  const [message, setMessage] = useState('Tap the map to draw at least three boundary points.');
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const [streetImportBusy, setStreetImportBusy] = useState(false);
  const [streetImportMessage, setStreetImportMessage] = useState('Import the polygon streets before field testing so worked and outstanding roads are both visible.');
  const [options, setOptions] = useState<AssignmentOptions | null>(null);
  const [adminAccess, setAdminAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [mapState, setMapState] = useState<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedCapturerId, setSelectedCapturerId] = useState('');
  const [assignmentAreaName, setAssignmentAreaName] = useState('Test capture area');
  const [assignmentMessage, setAssignmentMessage] = useState('Loading active projects and eligible capturers…');
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const [assigned, setAssigned] = useState<AssignmentResult | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  async function loadAssignmentOptions(preferredProjectId?: string) {
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/admin/project-assignment-options`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const body = await response.json() as AssignmentOptions & { message?: string };
      if (response.status === 401 || response.status === 403) setAdminAccess('denied');
      if (!response.ok || !Array.isArray(body.projects) || !Array.isArray(body.capturers)) throw new Error(body.message ?? 'Project assignment options are unavailable.');
      setAdminAccess('allowed');
      setOptions(body);
      setSelectedProjectId((current) => preferredProjectId ?? (current || body.projects[0]?.id || ''));
      setSelectedCapturerId((current) => current || body.capturers[0]?.id || '');
      setAssignmentMessage(body.capturers.length ? 'Select a project and field capturer.' : 'No eligible non-admin field capturer is registered in this workspace.');
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'Project assignment options are unavailable.');
    }
  }

  useEffect(() => { void loadAssignmentOptions(); }, []);
  useEffect(() => { const detected = Intl.DateTimeFormat().resolvedOptions().timeZone; if (detected) setTimeZone(detected); }, []);

  function syncPolygon(points: Coordinate[]) {
    setBoundary(points);
    polygonRef.current?.setPath(points.map((point) => ({ lat: point.latitude, lng: point.longitude })));
    setMessage(points.length < 3 ? `${points.length} point${points.length === 1 ? '' : 's'} set · add ${3 - points.length} more.` : `${points.length} boundary points ready.`);
  }

  function useAreaAround(position: { latitude: number; longitude: number }) {
    const latOffset = 0.00225;
    const lonOffset = latOffset / Math.max(Math.cos(position.latitude * Math.PI / 180), 0.2);
    const points = [
      { latitude: position.latitude - latOffset, longitude: position.longitude - lonOffset },
      { latitude: position.latitude - latOffset, longitude: position.longitude + lonOffset },
      { latitude: position.latitude + latOffset, longitude: position.longitude + lonOffset },
      { latitude: position.latitude + latOffset, longitude: position.longitude - lonOffset },
    ];
    syncPolygon(points);
    mapRef.current?.fitBounds(new window.google.maps.LatLngBounds(
      { lat: points[0]!.latitude, lng: points[0]!.longitude },
      { lat: points[2]!.latitude, lng: points[2]!.longitude },
    ));
  }

  function locateAndDraft() {
    if (!navigator.geolocation) return setMessage('Location is not available in this browser.');
    setMessage('Finding your current location…');
    navigator.geolocation.getCurrentPosition(({ coords }) => useAreaAround({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => setMessage(error.message || 'Current location could not be determined.'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 });
  }

  useEffect(() => {
    if (adminAccess !== 'allowed' || !apiKey || !hostRef.current) return;
    let cancelled = false;
    setMapState('loading');
    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !hostRef.current || !window.google?.maps) return;
      const maps = window.google.maps;
      const map = new maps.Map(hostRef.current, { center: { lat: -26.2455, lng: 27.8628 }, zoom: 13, styles: darkRoadmapStyle, streetViewControl: false, mapTypeControl: true, fullscreenControl: true, gestureHandling: 'greedy' });
      const polygon = new maps.Polygon({ map, paths: [], strokeColor: '#18dda5', strokeOpacity: 1, strokeWeight: 3, fillColor: '#18dda5', fillOpacity: .12, zIndex: 4 });
      mapRef.current = map;
      polygonRef.current = polygon;
      if (maps.places?.Autocomplete) {
        const control = document.createElement('div');
        control.className = styles.googlePlaceSearch ?? '';
        const icon = document.createElement('span'); icon.textContent = '⌕';
        const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Search Google Maps'; input.setAttribute('aria-label', 'Search Google Maps for a place or street');
        control.append(icon, input);
        map.controls[maps.ControlPosition.TOP_LEFT].push(control);
        searchControlRef.current = control;
        const autocomplete = new maps.places.Autocomplete(input, { fields: ['geometry', 'name', 'formatted_address'] });
        autocomplete.bindTo('bounds', map);
        placeListenerRef.current = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location) return setMessage('Select a result from Google Places to move the map.');
          if (place.geometry.viewport) map.fitBounds(place.geometry.viewport);
          else { map.setCenter(place.geometry.location); map.setZoom(17); }
          setMessage(`Map moved to ${place.formatted_address ?? place.name ?? 'the selected place'}. Tap the map to draw the boundary.`);
        });
      }
      clickListenerRef.current = map.addListener('click', (event: any) => {
        if (!event.latLng) return;
        setBoundary((current) => {
          const points = [...current, { latitude: event.latLng.lat(), longitude: event.latLng.lng() }];
          polygon.setPath(points.map((point) => ({ lat: point.latitude, lng: point.longitude })));
          setMessage(points.length < 3 ? `${points.length} points set · add ${3 - points.length} more.` : `${points.length} boundary points ready.`);
          return points;
        });
      });
      setMapState('ready');
    }).catch((error) => { setMapState('error'); setMessage(error instanceof Error ? error.message : 'Google Maps failed to load.'); });
    return () => { cancelled = true; clickListenerRef.current?.remove(); placeListenerRef.current?.remove(); searchControlRef.current?.remove(); searchControlRef.current = null; polygonRef.current?.setMap(null); };
  }, [adminAccess, apiKey]);

  async function publishProject() {
    setBusy(true);
    setMessage('Publishing project and test assignment…');
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/dev/projects/publish`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, areaName, boundary, timeZone, formTemplateId, questions }),
      });
      const body = await response.json() as PublishResult & { message?: string };
      if (!response.ok || !body.searchSession) throw new Error(body.message ?? 'The test project could not be published.');
      setPublished(body);
      setMessage('Project published. Your capture assignment is ready.');
      await loadAssignmentOptions(body.project.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The test project could not be published.');
    } finally {
      setBusy(false);
    }
  }

  async function assignCapturer() {
    if (!selectedProjectId || !selectedCapturerId) return;
    setAssignmentBusy(true);
    setAssigned(null);
    setAssignmentMessage('Creating the capturer assignment and field session…');
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/admin/projects/${encodeURIComponent(selectedProjectId)}/assign`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedCapturerId, areaName: assignmentAreaName }),
      });
      const body = await response.json() as AssignmentResult & { message?: string };
      if (!response.ok || !body.assignment) throw new Error(body.message ?? 'The capturer could not be assigned.');
      setAssigned(body);
      setAssignmentMessage(`${body.capturer.email} can now open ${body.project.name}.`);
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : 'The capturer could not be assigned.');
    } finally {
      setAssignmentBusy(false);
    }
  }

  async function importProjectStreets() {
    if (!published) return;
    setStreetImportBusy(true);
    setStreetImportMessage('Importing road geometry inside the published polygon…');
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/dev/projects/${encodeURIComponent(published.project.id)}/import-streets`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json() as { segmentCount?: number; message?: string };
      if (!response.ok || !body.segmentCount) throw new Error(body.message ?? 'The project streets could not be imported.');
      setStreetImportMessage(`${body.segmentCount} street segments imported. They begin red and turn green only where walking is confirmed.`);
    } catch (error) { setStreetImportMessage(error instanceof Error ? error.message : 'The project streets could not be imported.'); }
    finally { setStreetImportBusy(false); }
  }

  if (adminAccess !== 'allowed') return <main className={styles.page}><div className={styles.shell}><SurveyGuruSidebar active="project-map"/><section className={styles.main}><section className={accessStyles.accessCard}><p className={styles.eyebrow}>Project administration</p><h1>{adminAccess === 'checking' ? 'Checking administrator access…' : 'Administrator access required'}</h1><p>{adminAccess === 'checking' ? 'Confirming your workspace role.' : 'Only a workspace administrator can define, publish or assign project areas. Open your assigned work from Field Today.'}</p>{adminAccess === 'denied' ? <Link href="/field">Open Field Today</Link> : null}</section></section></div></main>;

  return <main className={styles.page}><div className={styles.shell}>
    <SurveyGuruSidebar active="project-map" />
    <section className={styles.main}>
      <header className={styles.header}><div><p>Survey Guru · Project setup</p><h1>Define a test capture area</h1><span>Draw the authorised boundary, publish it, then enter the field workflow using the assignment created for your signed-in account.</span></div><Link href="/projects/demo/map">Back to project map</Link></header>
      <div className={styles.grid}>
        <section className={styles.mapCard}>
          <div className={styles.mapFrame}><div ref={hostRef} className={styles.map}/>{!apiKey ? <div className={styles.mapNotice}>Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to draw the project area.</div> : mapState !== 'ready' ? <div className={styles.mapNotice}>{mapState === 'error' ? 'Google Maps could not load. Check the allowed website on the Maps API key, then refresh.' : 'Loading project-area map…'}</div> : null}</div>
          <div className={styles.mapActions}><button type="button" onClick={locateAndDraft}>⌾ Use area around me</button><button type="button" onClick={() => syncPolygon(boundary.slice(0, -1))} disabled={!boundary.length}>Undo point</button><button type="button" onClick={() => syncPolygon([])} disabled={!boundary.length}>Clear boundary</button></div>
        </section>
        <section className={styles.formCard}>
          <p className={styles.eyebrow}>Development publisher</p><h2>Project details</h2>
          <label>Project name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Capture area name<input value={areaName} onChange={(event) => setAreaName(event.target.value)} /></label>
          <label>Project area timezone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}><option value="Africa/Johannesburg">South Africa · Africa/Johannesburg</option><option value="Africa/Lagos">Nigeria · Africa/Lagos</option><option value="Africa/Maputo">Mozambique · Africa/Maputo</option><option value="Africa/Mbabane">Eswatini · Africa/Mbabane</option><option value="Africa/Maseru">Lesotho · Africa/Maseru</option><option value="Africa/Harare">Zimbabwe · Africa/Harare</option></select></label>
          <label>Capture form<select value={formTemplateId} onChange={(event) => setFormTemplateId(event.target.value as 'STANDARD_FMCG' | 'CUSTOM')}><option value="STANDARD_FMCG">Standard FMCG store form</option><option value="CUSTOM">Custom questionnaire only</option></select></label>
          {formTemplateId === 'STANDARD_FMCG' ? <div className={styles.scope}><strong>Standard form includes</strong><span>Owner or contact name</span><span>Multiple brands and products</span><span>Purchase and selling price</span><span>Daily sales volume</span><span>Storefront photo and GPS evidence</span></div> : null}
          <div className={questionStyles.questionBuilder}><div><strong>Additional questionnaire fields</strong><span>Create text, number or selection questions for this project.</span></div>{questions.map((question, index) => <fieldset key={`${question.id}-${index}`}><input aria-label="Question field name" value={question.id} placeholder="fieldName" onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, id: event.target.value.replace(/[^A-Za-z0-9_]/g, '') } : item))}/><input aria-label="Question label" value={question.label} placeholder="Question shown to capturer" onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))}/><select aria-label="Question type" value={question.type} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value as ProjectQuestion['type'] } : item))}><option value="text">Text</option><option value="number">Number</option><option value="select">Select one</option></select>{question.type === 'select' ? <input aria-label="Selectable options" value={question.options.join(', ')} placeholder="Option A, Option B" onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) } : item))}/> : null}<label className={questionStyles.requiredField}><input type="checkbox" checked={question.required} onChange={(event) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, required: event.target.checked } : item))}/>Required</label><button type="button" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></fieldset>)}<button type="button" onClick={() => setQuestions((current) => [...current, { id: `question${current.length + 1}`, label: '', type: 'text', required: true, options: [] }])}>＋ Add questionnaire field</button></div>
          <div className={styles.scope}><strong>What publication creates</strong><span>Active project and immutable boundary version</span><span>Exception-only store QA policy</span><span>Assignment to your current account</span><span>Ready field search session</span></div>
          <p className={styles.message} role="status">{message}</p>
          {published ? <div className={styles.success}><strong>{published.project.name} is live</strong><span>{published.assignment.areaName} · {published.project.boundaryAreaSquareKm.toFixed(2)} km²</span><button className={styles.publish} type="button" disabled={streetImportBusy} onClick={() => void importProjectStreets()}>{streetImportBusy ? 'Importing polygon streets…' : 'Import worked and outstanding streets'}</button><span>{streetImportMessage}</span><Link href={published.links.fieldMap}>Open assignment and capture →</Link><Link href={published.links.projectMap ?? `/projects/demo/map?project=${encodeURIComponent(published.project.id)}`}>Open this project map →</Link></div>
            : <button className={styles.publish} type="button" disabled={busy || boundary.length < 3 || name.trim().length < 3 || areaName.trim().length < 2} onClick={publishProject}>{busy ? 'Publishing…' : 'Publish test capture area'}</button>}
          <small>This development shortcut assigns the publishing administrator as capturer for this test. Production setup will keep administrator and field roles separate.</small>
        </section>
      </div>
      <section className={styles.assignmentCard}>
        <div><p className={styles.eyebrow}>Administrator handoff</p><h2>Assign a project to a field capturer</h2><p>The capturer receives project membership, one active assignment and a ready field session. Workspace-administrator accounts are excluded from this list.</p></div>
        <div className={styles.assignmentForm}>
          <label>Active project<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}><option value="">Select project</option>{options?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label>Field capturer<select value={selectedCapturerId} onChange={(event) => setSelectedCapturerId(event.target.value)}><option value="">Select capturer</option>{options?.capturers.map((capturer) => <option key={capturer.id} value={capturer.id}>{capturer.email} · {capturer.roleName}</option>)}</select></label>
          <label>Assigned area name<input value={assignmentAreaName} onChange={(event) => setAssignmentAreaName(event.target.value)} /></label>
          <button className={styles.publish} type="button" onClick={assignCapturer} disabled={assignmentBusy || !selectedProjectId || !selectedCapturerId || assignmentAreaName.trim().length < 2}>{assignmentBusy ? 'Assigning…' : 'Assign project to capturer'}</button>
        </div>
        <p className={styles.message} role="status">{assignmentMessage}</p>
        {assigned ? <div className={styles.success}><strong>Assignment ready</strong><span>{assigned.capturer.email} · {assigned.assignment.areaName}</span><span>The capturer must sign in with this account, then open their assignment link.</span><Link href={assigned.links.fieldMap}>Preview authorised field session →</Link></div> : null}
      </section>
    </section>
  </div></main>;
}
