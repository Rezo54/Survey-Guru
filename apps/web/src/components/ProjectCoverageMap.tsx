'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fieldApiOrigin, getFieldToken } from '../app/field/map/field-api';
import styles from './ProjectCoverageMap.module.css';

declare global {
  interface Window {
    google?: any;
    __surveyGuruGoogleMapsPromise?: Promise<void>;
  }
}

type Coordinate = { latitude: number; longitude: number };
type CoverageSlice = { geometry: Coordinate[]; state: 'CONFIRMED' | 'OUTSTANDING'; colour: 'green' | 'red' };
type CoverageSegment = {
  projectStreetSegmentId: string;
  geometry: Coordinate[];
  coverageState: 'UNCOVERED' | 'PARTIALLY_COVERED' | 'COVERED' | 'VERIFIED';
  coverageColour: 'red' | 'amber' | 'green';
  geometrySource?: { provider: string; sourceId: string; sourceVersion: string };
  coverageSlices?: CoverageSlice[];
};
type CoverageResponse = {
  projectId: string;
  ownership: 'PROJECT_SHARED';
  projectBoundary?: Coordinate[];
  streetSegments: CoverageSegment[];
  summary: { totalSegments: number; uncoveredSegments: number; partialSegments: number; coveredSegments: number };
  message?: string;
};

type CoverageColour = keyof typeof colours;
type RoadLine = { line: any; colour: CoverageColour };
export type CoverageMapType = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

const MAP_SCRIPT_ID = 'survey-guru-google-maps';
const colours = { red: '#ff5d55', amber: '#f3b333', green: '#18dda5' } as const;
const coverageLabels: Readonly<Record<CoverageColour, string>> = {
  red: 'Not walked',
  green: 'Walked',
  amber: 'Unresolved',
};

function coverageSignature(coverage: CoverageResponse): string {
  return coverage.streetSegments.map((segment) => {
    const slices = segment.coverageSlices?.map((slice) => {
      const first = slice.geometry[0];
      const last = slice.geometry[slice.geometry.length - 1];
      return `${slice.state}:${slice.colour}:${slice.geometry.length}:${first?.latitude}:${first?.longitude}:${last?.latitude}:${last?.longitude}`;
    }).join('|') ?? '';
    return `${segment.projectStreetSegmentId}:${segment.coverageState}:${segment.coverageColour}:${slices}`;
  }).join(';');
}
export const darkRoadmapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0c1e27' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#91aaa4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0c1e27' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#213b43' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#102a32' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#c4d7d2' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#071923' }, { weight: 4 }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#315860' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07151d' }] },
];

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window.__surveyGuruGoogleMapsPromise) return window.__surveyGuruGoogleMapsPromise;
  window.__surveyGuruGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
    document.head.appendChild(script);
  });
  return window.__surveyGuruGoogleMapsPromise;
}

export default function ProjectCoverageMap({ projectId, refreshKey = 0, variant = 'field', showHeader = true, mapType = 'roadmap', coverageLayerVisible = true, controlsVisible = true, locateRequest = 0 }: {
  projectId: string;
  refreshKey?: number;
  variant?: 'field' | 'project' | 'dashboard';
  showHeader?: boolean;
  mapType?: CoverageMapType;
  coverageLayerVisible?: boolean;
  controlsVisible?: boolean;
  locateRequest?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const roadLinesRef = useRef<RoadLine[]>([]);
  const locationMarkerRef = useRef<any>(null);
  const zoomListenerRef = useRef<any>(null);
  const controlsAttachedRef = useRef(false);
  const coverageSignatureRef = useRef<string | null>(null);
  const preferencesLoadedRef = useRef(false);
  const fittedRef = useRef(false);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coverageVisible, setCoverageVisible] = useState(true);
  const [visibleColours, setVisibleColours] = useState<Readonly<Record<CoverageColour, boolean>>>({ red: true, green: true, amber: true });
  const [controlsHost, setControlsHost] = useState<HTMLDivElement | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const usesOpenStreetMap = coverage?.streetSegments.some((segment) => segment.geometrySource?.provider === 'openstreetmap') === true;
  const effectiveCoverageVisible = coverageVisible && coverageLayerVisible;

  const loadCoverage = useCallback(async () => {
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/${encodeURIComponent(projectId)}/street-coverage`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const body = await response.json() as CoverageResponse;
      if (!response.ok || !Array.isArray(body.streetSegments)) throw new Error(body.message ?? 'Shared street coverage is unavailable.');
      const signature = coverageSignature(body);
      if (signature !== coverageSignatureRef.current) {
        coverageSignatureRef.current = signature;
        setCoverage(body);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Shared street coverage is unavailable.');
    }
  }, [projectId]);

  useEffect(() => {
    void loadCoverage();
    const timer = window.setInterval(() => { void loadCoverage(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadCoverage, refreshKey]);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(`survey-guru:coverage-map:${projectId}`);
      if (saved) {
        const preferences = JSON.parse(saved) as { coverageVisible?: boolean; visibleColours?: Partial<Record<CoverageColour, boolean>> };
        if (typeof preferences.coverageVisible === 'boolean') setCoverageVisible(preferences.coverageVisible);
        setVisibleColours((current) => ({ ...current, ...preferences.visibleColours }));
      }
    } catch {
      // Invalid or unavailable session storage should never block the map.
    }
    preferencesLoadedRef.current = true;
  }, [projectId]);

  useEffect(() => {
    if (!preferencesLoadedRef.current) return;
    try {
      window.sessionStorage.setItem(`survey-guru:coverage-map:${projectId}`, JSON.stringify({ coverageVisible, visibleColours }));
    } catch {
      // Session persistence is an enhancement; map controls remain functional without it.
    }
  }, [coverageVisible, projectId, visibleColours]);

  useEffect(() => {
    for (const roadLine of roadLinesRef.current) {
      roadLine.line.setVisible(effectiveCoverageVisible && visibleColours[roadLine.colour]);
    }
  }, [effectiveCoverageVisible, visibleColours]);

  useEffect(() => {
    mapRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  useEffect(() => {
    if (locateRequest < 1 || !mapRef.current || !window.google?.maps) return;
    if (!navigator.geolocation) {
      setError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const position = { lat: coords.latitude, lng: coords.longitude };
      mapRef.current.panTo(position);
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 14, 16));
      locationMarkerRef.current?.setMap(null);
      locationMarkerRef.current = new window.google.maps.Marker({ map: mapRef.current, position, title: 'Your current location', zIndex: 20 });
      setError(null);
    }, () => setError('Your current location could not be determined. Check browser location permission.'));
  }, [locateRequest]);

  useEffect(() => {
    if (!apiKey || !hostRef.current || !coverage) return;
    let cancelled = false;
    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !hostRef.current || !window.google?.maps) return;
      const maps = window.google.maps;
      const map = mapRef.current ?? new maps.Map(hostRef.current, {
        center: { lat: -26.2455, lng: 27.8628 }, zoom: variant === 'dashboard' ? 12 : 14, mapTypeId: mapType, styles: darkRoadmapStyle,
        streetViewControl: false, mapTypeControl: variant === 'project', fullscreenControl: true, zoomControl: true,
        gestureHandling: variant === 'dashboard' ? 'cooperative' : 'greedy',
      });
      mapRef.current = map;
      if (variant !== 'field' && !controlsAttachedRef.current) {
        const controlHost = document.createElement('div');
        map.controls[maps.ControlPosition.TOP_LEFT].push(controlHost);
        controlsAttachedRef.current = true;
        setControlsHost(controlHost);
      }
      for (const overlay of overlaysRef.current) overlay.setMap(null);
      overlaysRef.current = [];
      roadLinesRef.current = [];
      const bounds = new maps.LatLngBounds();

      if (coverage.projectBoundary && coverage.projectBoundary.length >= 3) {
        const path = coverage.projectBoundary.map((point) => ({ lat: point.latitude, lng: point.longitude }));
        path.forEach((point) => bounds.extend(point));
        overlaysRef.current.push(new maps.Polygon({ map, paths: path, strokeColor: '#3a9eff', strokeOpacity: .9, strokeWeight: 2, fillColor: '#287cff', fillOpacity: .07, zIndex: 1 }));
      }

      for (const segment of coverage.streetSegments) {
        const renderSlices = segment.coverageSlices?.length ? segment.coverageSlices : [{ geometry: segment.geometry, colour: segment.coverageColour }];
        for (const slice of renderSlices) {
          const path = slice.geometry.map((point) => ({ lat: point.latitude, lng: point.longitude }));
          if (path.length < 2) continue;
          path.forEach((point) => bounds.extend(point));
          const zoom = map.getZoom() ?? 14;
          const strokeWeight = zoom <= 11 ? 1 : zoom <= 14 ? 2 : 3;
          const roadLine = new maps.Polyline({ map, path, strokeColor: colours[slice.colour], strokeOpacity: .72, strokeWeight, zIndex: slice.colour === 'green' ? 4 : slice.colour === 'amber' ? 3 : 2, visible: effectiveCoverageVisible && visibleColours[slice.colour] });
          overlaysRef.current.push(roadLine);
          roadLinesRef.current.push({ line: roadLine, colour: slice.colour });
        }
      }
      if (!zoomListenerRef.current) {
        zoomListenerRef.current = map.addListener('zoom_changed', () => {
          const zoom = map.getZoom() ?? 14;
          const strokeWeight = zoom <= 11 ? 1 : zoom <= 14 ? 2 : 3;
          for (const roadLine of roadLinesRef.current) roadLine.line.setOptions({ strokeWeight });
        });
      }
      if (!bounds.isEmpty() && !fittedRef.current) {
        map.fitBounds(bounds, variant === 'dashboard' ? 18 : 34);
        fittedRef.current = true;
      }
    }).catch((cause: Error) => setError(cause.message));
    return () => { cancelled = true; };
  }, [apiKey, coverage, variant]);

  useEffect(() => () => {
    zoomListenerRef.current?.remove?.();
    zoomListenerRef.current = null;
    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];
    roadLinesRef.current = [];
    locationMarkerRef.current?.setMap(null);
    locationMarkerRef.current = null;
  }, []);

  const toggleColour = (colour: CoverageColour) => {
    setVisibleColours((current) => ({ ...current, [colour]: !current[colour] }));
  };

  const coverageControls = variant !== 'field' && controlsVisible ? <div className={styles.coverageControls} aria-label="Coverage layer controls">
    <button type="button" className={effectiveCoverageVisible ? styles.controlActive : ''} onClick={() => setCoverageVisible((current) => !current)} aria-pressed={effectiveCoverageVisible}>Coverage {effectiveCoverageVisible ? 'on' : 'off'}</button>
    {(Object.keys(coverageLabels) as CoverageColour[]).map((colour) => <button key={colour} type="button" className={effectiveCoverageVisible && visibleColours[colour] ? styles.controlActive : ''} onClick={() => toggleColour(colour)} aria-pressed={effectiveCoverageVisible && visibleColours[colour]} disabled={!effectiveCoverageVisible}><i className={styles[colour]}/>{coverageLabels[colour]}</button>)}
    {variant === 'dashboard' ? <a className={styles.expandMap} href="/projects/demo/map" aria-label="Expand project map">⤢ Expand map</a> : null}
  </div> : null;

  return <section className={styles.frame} data-variant={variant} data-header={showHeader ? 'true' : 'false'} aria-label="Shared project street coverage map">
    {showHeader ? <div className={styles.header}><div><p>Project-shared street coverage</p><h2>Walked streets and outstanding gaps</h2></div>{coverage ? <span>{coverage.summary.coveredSegments} complete · {coverage.summary.partialSegments} partial · {coverage.summary.uncoveredSegments} outstanding</span> : null}</div> : null}
    {apiKey ? <>
      <div ref={hostRef} className={styles.canvas} />
      {controlsHost && coverageControls ? createPortal(coverageControls, controlsHost) : null}
    </> : <div className={styles.fallback}>Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to display the street geometry.</div>}
    <div className={styles.legend}><span><i className={styles.green}/>Walked</span><span><i className={styles.amber}/>Unresolved</span><span><i className={styles.red}/>Not walked</span><b>{usesOpenStreetMap ? 'Street geometry © OpenStreetMap contributors · ' : ''}Project boundary and shared coverage · refreshes every 15 seconds</b></div>
    {error ? <p className={styles.error}>{error}</p> : null}
  </section>;
}
