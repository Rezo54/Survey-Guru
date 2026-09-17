'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import SurveyGuruSidebar from '../../../components/SurveyGuruSidebar';
import { darkRoadmapStyle, loadGoogleMaps } from '../../../components/ProjectCoverageMap';
import { fieldApiOrigin, getFieldToken } from '../../field/map/field-api';
import styles from './project-setup.module.css';

type Coordinate = { latitude: number; longitude: number };
type PublishResult = {
  project: { id: string; name: string; boundaryAreaSquareKm: number };
  assignment: { id: string; areaName: string };
  searchSession: { id: string; state: string };
  links: { fieldMap: string };
};

export default function NewProjectPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const [name, setName] = useState('Local Store Capture Test');
  const [areaName, setAreaName] = useState('Test capture area');
  const [boundary, setBoundary] = useState<Coordinate[]>([]);
  const [message, setMessage] = useState('Tap the map to draw at least three boundary points.');
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState<PublishResult | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
    if (!apiKey || !hostRef.current) return;
    let cancelled = false;
    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !hostRef.current || !window.google?.maps) return;
      const maps = window.google.maps;
      const map = new maps.Map(hostRef.current, { center: { lat: -26.2455, lng: 27.8628 }, zoom: 13, styles: darkRoadmapStyle, streetViewControl: false, mapTypeControl: true, fullscreenControl: true, gestureHandling: 'greedy' });
      const polygon = new maps.Polygon({ map, paths: [], strokeColor: '#18dda5', strokeOpacity: 1, strokeWeight: 3, fillColor: '#18dda5', fillOpacity: .12, zIndex: 4 });
      mapRef.current = map;
      polygonRef.current = polygon;
      clickListenerRef.current = map.addListener('click', (event: any) => {
        if (!event.latLng) return;
        setBoundary((current) => {
          const points = [...current, { latitude: event.latLng.lat(), longitude: event.latLng.lng() }];
          polygon.setPath(points.map((point) => ({ lat: point.latitude, lng: point.longitude })));
          setMessage(points.length < 3 ? `${points.length} points set · add ${3 - points.length} more.` : `${points.length} boundary points ready.`);
          return points;
        });
      });
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'Google Maps failed to load.'));
    return () => { cancelled = true; clickListenerRef.current?.remove(); polygonRef.current?.setMap(null); };
  }, [apiKey]);

  async function publishProject() {
    setBusy(true);
    setMessage('Publishing project and test assignment…');
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/dev/projects/publish`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, areaName, boundary }),
      });
      const body = await response.json() as PublishResult & { message?: string };
      if (!response.ok || !body.searchSession) throw new Error(body.message ?? 'The test project could not be published.');
      setPublished(body);
      setMessage('Project published. Your capture assignment is ready.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The test project could not be published.');
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}><div className={styles.shell}>
    <SurveyGuruSidebar active="project-map" />
    <section className={styles.main}>
      <header className={styles.header}><div><p>Survey Guru · Project setup</p><h1>Define a test capture area</h1><span>Draw the authorised boundary, publish it, then enter the field workflow using the assignment created for your signed-in account.</span></div><Link href="/projects/demo/map">Back to project map</Link></header>
      <div className={styles.grid}>
        <section className={styles.mapCard}>
          <div ref={hostRef} className={styles.map}>{!apiKey ? 'Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to draw the project area.' : null}</div>
          <div className={styles.mapActions}><button type="button" onClick={locateAndDraft}>⌾ Use area around me</button><button type="button" onClick={() => syncPolygon(boundary.slice(0, -1))} disabled={!boundary.length}>Undo point</button><button type="button" onClick={() => syncPolygon([])} disabled={!boundary.length}>Clear boundary</button></div>
        </section>
        <section className={styles.formCard}>
          <p className={styles.eyebrow}>Development publisher</p><h2>Project details</h2>
          <label>Project name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Capture area name<input value={areaName} onChange={(event) => setAreaName(event.target.value)} /></label>
          <div className={styles.scope}><strong>What publication creates</strong><span>Active project and immutable boundary version</span><span>Exception-only store QA policy</span><span>Assignment to your current account</span><span>Ready field search session</span></div>
          <p className={styles.message} role="status">{message}</p>
          {published ? <div className={styles.success}><strong>{published.project.name} is live</strong><span>{published.assignment.areaName} · {published.project.boundaryAreaSquareKm.toFixed(2)} km²</span><Link href={published.links.fieldMap}>Open assignment and capture →</Link></div>
            : <button className={styles.publish} type="button" disabled={busy || boundary.length < 3 || name.trim().length < 3 || areaName.trim().length < 2} onClick={publishProject}>{busy ? 'Publishing…' : 'Publish test capture area'}</button>}
          <small>This development shortcut assigns the publishing administrator as capturer for this test. Production setup will keep administrator and field roles separate.</small>
        </section>
      </div>
    </section>
  </div></main>;
}
