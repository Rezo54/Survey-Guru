'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './project-map.module.css';

declare global {
  interface Window {
    google?: any;
    __surveyGuruGoogleMapsPromise?: Promise<void>;
  }
}

const MAP_SCRIPT_ID = 'survey-guru-google-maps';

function loadGoogleMaps(apiKey: string) {
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

const darkRoadmapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0c1e27' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8fa6a2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0c1e27' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#25424a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#213b43' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#102a32' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#91aaa4' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#315860' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#07151d' }] },
];

const projectBoundary = [
  { lat: -26.201, lng: 27.824 },
  { lat: -26.193, lng: 27.876 },
  { lat: -26.214, lng: 27.913 },
  { lat: -26.253, lng: 27.916 },
  { lat: -26.281, lng: 27.892 },
  { lat: -26.289, lng: 27.843 },
  { lat: -26.264, lng: 27.806 },
  { lat: -26.226, lng: 27.803 },
];

const searchedPath = [
  { lat: -26.251, lng: 27.815 },
  { lat: -26.244, lng: 27.835 },
  { lat: -26.238, lng: 27.856 },
  { lat: -26.232, lng: 27.878 },
];

const partialPath = [
  { lat: -26.258, lng: 27.868 },
  { lat: -26.263, lng: 27.892 },
  { lat: -26.266, lng: 27.906 },
];

const unknownPath = [
  { lat: -26.246, lng: 27.894 },
  { lat: -26.259, lng: 27.896 },
  { lat: -26.272, lng: 27.897 },
];

export default function ProjectGoogleMap() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !hostRef.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !hostRef.current || !window.google?.maps) return;

        const maps = window.google.maps;
        const map = new maps.Map(hostRef.current, {
          center: { lat: -26.2455, lng: 27.8628 },
          zoom: 13,
          mapTypeId: 'roadmap',
          styles: darkRoadmapStyle,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: maps.ControlPosition.TOP_RIGHT,
            mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
          },
          zoomControl: true,
          gestureHandling: 'greedy',
        });

        new maps.Polygon({
          map,
          paths: projectBoundary,
          strokeColor: '#3a9eff',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: '#287cff',
          fillOpacity: 0.08,
        });

        new maps.Polyline({
          map,
          path: searchedPath,
          strokeColor: '#1de0a8',
          strokeOpacity: 1,
          strokeWeight: 6,
        });

        new maps.Polyline({
          map,
          path: partialPath,
          strokeColor: '#f6b638',
          strokeOpacity: 1,
          strokeWeight: 6,
        });

        new maps.Polyline({
          map,
          path: unknownPath,
          strokeColor: '#ff6254',
          strokeOpacity: 1,
          strokeWeight: 6,
        });

        new maps.Circle({
          map,
          center: { lat: -26.218, lng: 27.901 },
          radius: 850,
          strokeColor: '#ff776b',
          strokeOpacity: 0.7,
          strokeWeight: 1,
          fillColor: '#ff6254',
          fillOpacity: 0.19,
        });

        new maps.Marker({
          map,
          position: { lat: -26.218, lng: 27.901 },
          label: { text: '74', color: '#ffffff', fontWeight: '800' },
          title: '74 priority-profile outlets',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 18,
            fillColor: '#ff6254',
            fillOpacity: 0.9,
            strokeColor: '#ff8f86',
            strokeWeight: 2,
          },
        });

        new maps.Circle({
          map,
          center: { lat: -26.275, lng: 27.872 },
          radius: 620,
          strokeColor: '#ff776b',
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: '#ff6254',
          fillOpacity: 0.15,
        });

        new maps.Marker({
          map,
          position: { lat: -26.275, lng: 27.872 },
          label: { text: '03', color: '#ffffff', fontWeight: '800' },
          title: 'Dobsonville Cluster 03',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 15,
            fillColor: '#ff6254',
            fillOpacity: 0.9,
            strokeColor: '#ff8f86',
            strokeWeight: 2,
          },
        });

        new maps.Marker({
          map,
          position: { lat: -26.248, lng: 27.847 },
          title: 'Team 04',
          label: { text: '04', color: '#041812', fontWeight: '900' },
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: '#1de0a8',
            fillOpacity: 1,
            strokeColor: '#c4fff0',
            strokeWeight: 2,
          },
        });
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  if (!apiKey) {
    return (
      <div className={styles.mapStage}>
        <div className={styles.mapSetup}>
          <span className={styles.setupBadge}>LOCAL MAP SETUP</span>
          <h3>Connect Google Maps to use the real project map.</h3>
          <p>Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to <code>apps/web/.env.local</code>, then restart <code>npm run dev:web</code>.</p>
          <p className={styles.setupNote}>No production key is stored in the repository.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mapStage}>
      <div ref={hostRef} className={styles.googleMap} aria-label="Interactive Soweto project coverage map" />
      {error ? <div className={styles.mapError}>{error}</div> : null}
      <div className={styles.legend}>
        <span><i />Searched / verified</span>
        <span><i />Partial evidence</span>
        <span><i />Outstanding / unknown</span>
        <span><b />Team 04</span>
      </div>
      <div className={styles.mapHint}>Map view: Roadmap · Satellite · Hybrid · Terrain</div>
      <div className={styles.bottomBar}>
        <div className={styles.mapMeta}><strong>72% reconciled</strong> · 118 km outstanding · 41 visits awaiting QA</div>
        <Link className={styles.mapAction} href="/opportunities/demo">Open Cluster 03 →</Link>
      </div>
    </div>
  );
}
