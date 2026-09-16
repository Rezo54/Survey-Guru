'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldApiOrigin, getFieldToken } from './field-api';
import styles from './SharedStreetCoverageMap.module.css';

declare global {
  interface Window {
    google?: any;
    __surveyGuruGoogleMapsPromise?: Promise<void>;
  }
}

type Coordinate = { latitude: number; longitude: number };
type StreetCoverageSegment = {
  projectStreetSegmentId: string;
  streetSegmentId: string;
  geometry: Coordinate[];
  coverageState: 'UNCOVERED' | 'PARTIALLY_COVERED' | 'COVERED' | 'VERIFIED';
  coverageColour: 'red' | 'amber' | 'green';
  coveredMetres: number;
  coveragePercent: number;
};
type CoverageResponse = {
  projectId: string;
  ownership: 'PROJECT_SHARED';
  streetSegments: StreetCoverageSegment[];
  summary: { totalSegments: number; uncoveredSegments: number; partialSegments: number; coveredSegments: number };
  message?: string;
};

const MAP_SCRIPT_ID = 'survey-guru-google-maps';
const colours = { red: '#ff5d55', amber: '#f3b333', green: '#18dda5' } as const;

function loadGoogleMaps(apiKey: string): Promise<void> {
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

export default function SharedStreetCoverageMap({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const loadCoverage = useCallback(async () => {
    try {
      const token = await getFieldToken();
      const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/${encodeURIComponent(projectId)}/street-coverage`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const body = await response.json() as CoverageResponse;
      if (!response.ok || !Array.isArray(body.streetSegments)) throw new Error(body.message ?? 'Shared street coverage is unavailable.');
      setCoverage(body);
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
    if (!apiKey || !hostRef.current || !coverage) return;
    let cancelled = false;
    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !hostRef.current || !window.google?.maps) return;
      const maps = window.google.maps;
      const map = mapRef.current ?? new maps.Map(hostRef.current, { center: { lat: -26.2455, lng: 27.8628 }, zoom: 14, mapTypeId: 'roadmap', streetViewControl: false, mapTypeControl: false, fullscreenControl: true, gestureHandling: 'greedy' });
      mapRef.current = map;
      for (const polyline of polylinesRef.current) polyline.setMap(null);
      polylinesRef.current = [];
      const bounds = new maps.LatLngBounds();
      for (const segment of coverage.streetSegments) {
        const path = segment.geometry.map((point) => ({ lat: point.latitude, lng: point.longitude }));
        for (const point of path) bounds.extend(point);
        polylinesRef.current.push(new maps.Polyline({ map, path, strokeColor: colours[segment.coverageColour], strokeOpacity: .96, strokeWeight: 7, zIndex: segment.coverageColour === 'green' ? 3 : segment.coverageColour === 'amber' ? 2 : 1 }));
      }
      if (!bounds.isEmpty()) map.fitBounds(bounds, 34);
    }).catch((cause: Error) => setError(cause.message));
    return () => { cancelled = true; };
  }, [apiKey, coverage]);

  return <section className={styles.sharedMap} aria-label="Shared project street coverage">
    <div className={styles.header}><div><p className={styles.eyebrow}>Project-shared street coverage</p><h2>Walked streets and outstanding gaps</h2></div>{coverage ? <span>{coverage.summary.coveredSegments} complete · {coverage.summary.partialSegments} partial · {coverage.summary.uncoveredSegments} outstanding</span> : null}</div>
    {apiKey ? <div ref={hostRef} className={styles.canvas} /> : <div className={styles.fallback}>Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to display the street geometry.</div>}
    <div className={styles.legend}><span><i className={styles.green}/>Completed</span><span><i className={styles.amber}/>Partial / uncertain</span><span><i className={styles.red}/>Not walked</span><b>Shared across authorised project users · refreshes every 15 seconds</b></div>
    {error ? <p className={styles.error}>{error}</p> : null}
  </section>;
}
