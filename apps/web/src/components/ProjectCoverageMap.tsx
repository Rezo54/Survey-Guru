'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fieldApiOrigin, getFieldToken, getFieldUserLabel } from '../app/field/map/field-api';
import styles from './ProjectCoverageMap.module.css';
import storeStyles from './ProjectStoreMarkers.module.css';

declare global {
  interface Window {
    google?: any;
    __surveyGuruGoogleMapsPromise?: Promise<void>;
    __surveyGuruGooglePlacesPromise?: Promise<void>;
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
  capturedStores?: CapturedStore[];
  storeInsights?: { totalCaptures: number; correctCaptures: number; capturedToday: number; densityPerSquareKm: number | null; statusCounts: Record<string, number>; brandPerformance: Array<{ brand: string; stores: number }>; capturers: Array<{ userId: string; name: string; captures: number }> };
  summary: { totalSegments: number; uncoveredSegments: number; partialSegments: number; coveredSegments: number; totalRoadMetres?: number; walkedRoadMetres?: number; walkedPercent?: number; capturedStoreCount?: number; capturedStoreScope?: 'ALL_PROJECT_USERS' | 'CURRENT_USER' };
  message?: string;
};
type CapturedStore = { captureId: string; storeId?: string; name: string; status: 'VERIFIED' | 'READY_FOR_EXPORT' | 'SYNCED'; location: Coordinate; answers?: Record<string, unknown>; capturerUserId?: string; capturerName?: string; capturedAt?: string; capturedLocalTime?: string; projectTimeZone?: string; capturedToday?: boolean; photoCount: number; exportState?: string };

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
  const streets = coverage.streetSegments.map((segment) => {
    const slices = segment.coverageSlices?.map((slice) => {
      const first = slice.geometry[0];
      const last = slice.geometry[slice.geometry.length - 1];
      return `${slice.state}:${slice.colour}:${slice.geometry.length}:${first?.latitude}:${first?.longitude}:${last?.latitude}:${last?.longitude}`;
    }).join('|') ?? '';
    return `${segment.projectStreetSegmentId}:${segment.coverageState}:${segment.coverageColour}:${slices}`;
  }).join(';');
  const stores = (coverage.capturedStores ?? []).map((store) => `${store.captureId}:${store.status}:${store.photoCount}:${store.capturedToday}:${store.capturerUserId}:${store.location.latitude}:${store.location.longitude}`).join(';');
  return `${streets}::${stores}::${coverage.summary.walkedPercent ?? 0}:${coverage.summary.capturedStoreCount ?? 0}:${coverage.summary.capturedStoreScope ?? ''}`;
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load.'));
    document.head.appendChild(script);
  });
  return window.__surveyGuruGoogleMapsPromise;
}

export function loadGooglePlaces(): Promise<void> {
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (window.__surveyGuruGooglePlacesPromise) return window.__surveyGuruGooglePlacesPromise;
  window.__surveyGuruGooglePlacesPromise = Promise.resolve(window.google?.maps?.importLibrary?.('places')).then(() => undefined);
  return window.__surveyGuruGooglePlacesPromise;
}

export default function ProjectCoverageMap({ projectId, refreshKey = 0, variant = 'field', showHeader = true, mapType = 'roadmap', coverageLayerVisible = true, controlsVisible = true, locateRequest = 0, captureHref }: {
  projectId: string;
  refreshKey?: number;
  variant?: 'field' | 'project' | 'dashboard';
  showHeader?: boolean;
  mapType?: CoverageMapType;
  coverageLayerVisible?: boolean;
  controlsVisible?: boolean;
  locateRequest?: number;
  captureHref?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const roadLinesRef = useRef<RoadLine[]>([]);
  const storeMarkersRef = useRef<any[]>([]);
  const photoUrlsRef = useRef<string[]>([]);
  const locationMarkerRef = useRef<any>(null);
  const locationAccuracyRef = useRef<any>(null);
  const locationWatchRef = useRef<number | null>(null);
  const latestLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const locationControlRef = useRef<HTMLButtonElement | null>(null);
  const searchControlRef = useRef<HTMLDivElement | null>(null);
  const placeListenerRef = useRef<any>(null);
  const zoomListenerRef = useRef<any>(null);
  const controlsAttachedRef = useRef(false);
  const coverageSignatureRef = useRef<string | null>(null);
  const currentProjectRef = useRef(projectId);
  const preferencesLoadedRef = useRef(false);
  const fittedRef = useRef(false);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coverageVisible, setCoverageVisible] = useState(true);
  const [storesVisible, setStoresVisible] = useState(true);
  const [selectedCapturer, setSelectedCapturer] = useState('ALL');
  const [visibleColours, setVisibleColours] = useState<Readonly<Record<CoverageColour, boolean>>>({ red: true, green: true, amber: true });
  const [controlsHost, setControlsHost] = useState<HTMLDivElement | null>(null);
  const [colourTheme, setColourTheme] = useState<'dark' | 'light'>('dark');
  const [expanded, setExpanded] = useState(false);
  const [liveUserLabel, setLiveUserLabel] = useState('Signed-in user');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const usesOpenStreetMap = coverage?.streetSegments.some((segment) => segment.geometrySource?.provider === 'openstreetmap') === true;
  const effectiveCoverageVisible = coverageVisible && coverageLayerVisible;

  useEffect(() => {
    let cancelled = false;
    void getFieldUserLabel().then((label) => { if (!cancelled) setLiveUserLabel(label); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    currentProjectRef.current = projectId;
    coverageSignatureRef.current = null;
    fittedRef.current = false;
    setCoverage(null);
    setError(null);
  }, [projectId]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);

  useEffect(() => {
    const readTheme = () => setColourTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    readTheme();
    window.addEventListener('survey-guru-theme', readTheme);
    return () => window.removeEventListener('survey-guru-theme', readTheme);
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapId) return;
    mapRef.current.setOptions({ styles: colourTheme === 'light' ? undefined : darkRoadmapStyle });
  }, [colourTheme, mapId]);

  const loadCoverage = useCallback(async () => {
    try {
      const token = await getFieldToken();
      const endpoint = `${fieldApiOrigin()}/api/v1/projects/${encodeURIComponent(projectId)}/street-coverage`;
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const contentType = response.headers.get('content-type') ?? '';
      const responseText = await response.text();
      if (!contentType.includes('application/json')) {
        const host = (() => { try { return new URL(endpoint).host; } catch { return endpoint; } })();
        throw new Error(`Coverage API returned HTTP ${response.status} from ${host}, but the response was a web page. Check NEXT_PUBLIC_SURVEY_GURU_API_URL and that the API tunnel points to port 8080.`);
      }
      const body = JSON.parse(responseText) as CoverageResponse;
      if (!response.ok || !Array.isArray(body.streetSegments)) throw new Error(body.message ?? 'Shared street coverage is unavailable.');
      if (currentProjectRef.current !== projectId) return;
      const signature = coverageSignature(body);
      if (signature !== coverageSignatureRef.current) {
        coverageSignatureRef.current = signature;
        setCoverage(body);
      }
      setError(null);
    } catch (cause) {
      if (currentProjectRef.current !== projectId) return;
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
    for (const marker of storeMarkersRef.current) {
      if (typeof marker.setVisible === 'function') marker.setVisible(storesVisible);
      else marker.map = storesVisible ? mapRef.current : null;
    }
  }, [storesVisible]);

  useEffect(() => {
    mapRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  useEffect(() => {
    if (locateRequest < 1 || !mapRef.current || !window.google?.maps) return;
    if (!navigator.geolocation || !latestLocationRef.current) {
      setError('Location is not available in this browser.');
      return;
    }
    mapRef.current.panTo(latestLocationRef.current);
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 14, 17));
    setError(null);
  }, [locateRequest]);

  useEffect(() => {
    if (!apiKey || !hostRef.current) return;
    let cancelled = false;
    void loadGoogleMaps(apiKey).then(() => {
      if (cancelled || !hostRef.current || !window.google?.maps) return;
      const maps = window.google.maps;
      const map = mapRef.current ?? new maps.Map(hostRef.current, {
        center: { lat: -26.2455, lng: 27.8628 }, zoom: variant === 'dashboard' ? 12 : 14, mapTypeId: mapType, styles: mapId || colourTheme === 'light' ? undefined : darkRoadmapStyle, ...(mapId ? { mapId } : {}),
        streetViewControl: false, mapTypeControl: variant === 'project', fullscreenControl: true, zoomControl: true,
        gestureHandling: variant === 'dashboard' ? 'cooperative' : 'greedy',
      });
      mapRef.current = map;
      if (!locationControlRef.current) {
        const locate = document.createElement('button');
        locate.type = 'button'; locate.className = styles.locationControl ?? ''; locate.title = 'Snap to my live location'; locate.setAttribute('aria-label', 'Snap map to my live location'); locate.textContent = '◎';
        locate.addEventListener('click', () => {
          if (!latestLocationRef.current) return setError('Waiting for your live location. Check location permission.');
          map.panTo(latestLocationRef.current); map.setZoom(Math.max(map.getZoom() ?? 14, 17)); setError(null);
        });
        map.controls[maps.ControlPosition.RIGHT_BOTTOM].push(locate); locationControlRef.current = locate;
      }
      if (locationWatchRef.current === null && navigator.geolocation && window.isSecureContext) {
        locationWatchRef.current = navigator.geolocation.watchPosition(({ coords }) => {
          const position = { lat: coords.latitude, lng: coords.longitude }; latestLocationRef.current = position;
          if (locationMarkerRef.current) {
            if (typeof locationMarkerRef.current.setPosition === 'function') locationMarkerRef.current.setPosition(position);
            else locationMarkerRef.current.position = position;
          } else if (mapId && maps.marker?.AdvancedMarkerElement) {
            const pin = document.createElement('div'); pin.className = styles.liveLocationPin ?? '';
            const name = document.createElement('strong'); name.textContent = liveUserLabel;
            const dot = document.createElement('span'); pin.append(name, dot);
            locationMarkerRef.current = new maps.marker.AdvancedMarkerElement({ map, position, title: `${liveUserLabel} · live location`, zIndex: 30, content: pin });
          } else locationMarkerRef.current = new maps.Marker({ map, position, title: `${liveUserLabel} · live location`, label: { text: liveUserLabel, color: '#ffffff', fontWeight: '700', fontSize: '12px', className: styles.liveLocationLabel ?? '' }, zIndex: 30, icon: { path: maps.SymbolPath.CIRCLE, fillColor: '#1479ff', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3, scale: 8 }, optimized: false });
          if (!locationAccuracyRef.current) locationAccuracyRef.current = new maps.Circle({ map, center: position, radius: coords.accuracy, strokeColor: '#1479ff', strokeOpacity: .45, strokeWeight: 1, fillColor: '#1479ff', fillOpacity: .1, clickable: false, zIndex: 5 });
          else { locationAccuracyRef.current.setCenter(position); locationAccuracyRef.current.setRadius(coords.accuracy); }
        }, () => undefined, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
      }
      if (!placeListenerRef.current && !searchControlRef.current) void loadGooglePlaces().then(() => {
        if (cancelled || searchControlRef.current) return;
        const control = document.createElement('div'); control.className = styles.googlePlaceSearch ?? '';
        if (maps.places?.PlaceAutocompleteElement) {
          const autocomplete = new maps.places.PlaceAutocompleteElement({}); autocomplete.setAttribute('placeholder', 'Search places and streets'); autocomplete.setAttribute('aria-label', 'Search Google Maps'); control.append(autocomplete);
          const onSelect = async (event: any) => { const place = event.placePrediction?.toPlace?.(); if (!place) return; await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location', 'viewport'] }); if (place.viewport) map.fitBounds(place.viewport); else if (place.location) { map.panTo(place.location); map.setZoom(17); } setError(null); };
          autocomplete.addEventListener('gmp-select', onSelect); placeListenerRef.current = { remove: () => autocomplete.removeEventListener('gmp-select', onSelect) };
        } else if (maps.places?.Autocomplete) {
          const input = document.createElement('input'); input.type = 'search'; input.placeholder = 'Search places and streets'; input.setAttribute('aria-label', 'Search Google Maps'); control.append(input);
          const autocomplete = new maps.places.Autocomplete(input, { fields: ['geometry', 'name', 'formatted_address'] }); autocomplete.bindTo('bounds', map);
          placeListenerRef.current = autocomplete.addListener('place_changed', () => { const place = autocomplete.getPlace(); if (!place.geometry?.location) return; if (place.geometry.viewport) map.fitBounds(place.geometry.viewport); else { map.panTo(place.geometry.location); map.setZoom(17); } setError(null); });
        } else return;
        map.controls[maps.ControlPosition.TOP_CENTER].push(control); searchControlRef.current = control;
      }).catch(() => setError('Google Places search is temporarily unavailable.'));
      if (variant !== 'field' && !controlsAttachedRef.current) {
        const controlHost = document.createElement('div');
        map.controls[maps.ControlPosition.TOP_LEFT].push(controlHost);
        controlsAttachedRef.current = true;
        setControlsHost(controlHost);
      }
      for (const overlay of overlaysRef.current) { if (typeof overlay.setMap === 'function') overlay.setMap(null); else overlay.map = null; }
      overlaysRef.current = [];
      roadLinesRef.current = [];
      storeMarkersRef.current = [];
      const bounds = new maps.LatLngBounds();

      if (coverage?.projectBoundary && coverage.projectBoundary.length >= 3) {
        const path = coverage.projectBoundary.map((point) => ({ lat: point.latitude, lng: point.longitude }));
        path.forEach((point) => bounds.extend(point));
        overlaysRef.current.push(new maps.Polygon({ map, paths: path, strokeColor: '#3a9eff', strokeOpacity: .9, strokeWeight: 2, fillColor: '#287cff', fillOpacity: .07, zIndex: 1 }));
      }

      for (const segment of coverage?.streetSegments ?? []) {
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
      for (const store of (coverage?.capturedStores ?? []).filter((item) => selectedCapturer === 'ALL' || item.capturerUserId === selectedCapturer)) {
        if (!Number.isFinite(store.location?.latitude) || !Number.isFinite(store.location?.longitude)) continue;
        const position = { lat: store.location.latitude, lng: store.location.longitude };
        bounds.extend(position);
        const title = `${store.name} · ${store.capturerName ?? 'Capturer unavailable'}`;
        let marker: any;
        if (mapId && maps.marker?.AdvancedMarkerElement) {
          const dot = document.createElement('div'); dot.className = store.capturedToday ? (storeStyles.advancedTodayMarker ?? '') : (storeStyles.advancedStoreMarker ?? '');
          marker = new maps.marker.AdvancedMarkerElement({ map: storesVisible ? map : null, position, title, zIndex: 12, content: dot });
        } else marker = new maps.Marker({ map, position, title, visible: storesVisible, zIndex: 12, icon: { path: maps.SymbolPath.CIRCLE, fillColor: store.capturedToday ? '#f3b333' : '#18dda5', fillOpacity: 1, strokeColor: '#eafff8', strokeWeight: 2, scale: store.capturedToday ? 8 : 7 } });
        const infoWindow = new maps.InfoWindow();
        marker.addListener('click', () => {
          const panel = document.createElement('div'); panel.className = storeStyles.storePopup ?? '';
          const heading = document.createElement('strong'); heading.textContent = store.name;
          const localTime = store.capturedAt ? new Date(store.capturedAt).toLocaleString('en-ZA', { timeZone: store.projectTimeZone ?? 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'medium' }) : 'Captured';
          const integrationState = store.status === 'SYNCED' ? 'Synced' : store.status === 'READY_FOR_EXPORT' ? 'Ready for export' : 'Verified';
          const meta = document.createElement('span'); meta.textContent = `${store.capturedToday ? 'Captured today' : 'Earlier capture'} · ${store.capturerName ?? 'Capturer unavailable'} · ${integrationState} · ${localTime} (${store.projectTimeZone ?? 'project time'})`;
          panel.append(heading, meta);
          const answerEntries = Object.entries(store.answers ?? {});
          const repeatedAnswer = (...names: string[]) => { const wanted = new Set(names.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, ''))); const found = answerEntries.find(([key]) => wanted.has(key.toLowerCase().replace(/[^a-z0-9]/g, '')))?.[1]; return Array.isArray(found) ? found : []; };
          const brandProducts = Array.isArray(store.answers?.brandProducts) ? store.answers.brandProducts as Array<Record<string, unknown>> : [];
          const repeatedBrands = repeatedAnswer('selectBrand', 'brandSelection', 'brand');
          const repeatedProducts = repeatedAnswer('product');
          const repeatedSizes = repeatedAnswer('selectProductType', 'productSize');
          const repeatedPurchase = repeatedAnswer('costPrice', 'purchasePrice');
          const repeatedSelling = repeatedAnswer('sellingPrice');
          const repeatedVolume = repeatedAnswer('volume', 'dailyVolume', 'dailySalesVolume');
          const customProductCount = Math.max(repeatedBrands.length, repeatedProducts.length, repeatedSizes.length, repeatedPurchase.length, repeatedSelling.length, repeatedVolume.length);
          const productRows = brandProducts.length ? brandProducts : Array.from({ length: customProductCount }, (_, index) => ({ brand: repeatedBrands[index], product: [repeatedProducts[index], repeatedSizes[index]].filter(Boolean).join(' '), purchasePrice: repeatedPurchase[index], sellingPrice: repeatedSelling[index], dailySalesVolume: repeatedVolume[index] }));
          if (productRows.length) {
            const productSales = document.createElement('details'); productSales.className = storeStyles.productSales ?? '';
            const productSalesToggle = document.createElement('summary'); productSalesToggle.textContent = '＋ Product sales'; productSales.append(productSalesToggle);
            for (const item of productRows) {
              const detail = document.createElement('span');
              const purchase = typeof item.purchasePrice === 'number' ? `buy R${item.purchasePrice.toFixed(2)}` : 'purchase price unavailable';
              const selling = typeof item.sellingPrice === 'number' ? `sell R${item.sellingPrice.toFixed(2)}` : 'selling price unavailable';
              const volume = typeof item.dailySalesVolume === 'number' ? `${item.dailySalesVolume} sold daily` : 'daily volume unavailable';
              detail.textContent = `${String(item.brand ?? 'Brand')} · ${String(item.product ?? 'Product')} · ${purchase} · ${selling} · ${volume}`;
              productSales.append(detail);
            }
            panel.append(productSales);
          } else {
            const pricing = Array.isArray(store.answers?.pricing) ? store.answers.pricing as Array<{ product?: unknown; price?: unknown }> : [];
            for (const item of pricing) { const detail = document.createElement('span'); detail.textContent = `${String(item.product ?? 'Product')} · ${typeof item.price === 'number' ? item.price.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' }) : 'Price unavailable'}`; panel.append(detail); }
          }
          if (store.photoCount > 0) {
            const gallery = document.createElement('div'); gallery.className = storeStyles.storeGallery ?? '';
            const loading = document.createElement('span'); loading.textContent = `Loading ${store.photoCount} photo${store.photoCount === 1 ? '' : 's'}…`; gallery.append(loading); panel.append(gallery);
            void (async () => {
              try {
                const token = await getFieldToken();
                const photos = await Promise.all(Array.from({ length: store.photoCount }, async (_, index) => {
                  const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/${encodeURIComponent(projectId)}/store-captures/${encodeURIComponent(store.captureId)}/photos/${index}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
                  if (!response.ok) throw new Error('Photo unavailable');
                  const url = URL.createObjectURL(await response.blob()); photoUrlsRef.current.push(url); return url;
                }));
                gallery.replaceChildren(...photos.map((url, index) => { const image = document.createElement('img'); image.src = url; image.alt = `${store.name} evidence ${index + 1}`; return image; }));
              } catch { loading.textContent = 'Photo evidence is temporarily unavailable.'; }
            })();
          }
          infoWindow.setContent(panel); infoWindow.open({ map, anchor: marker });
        });
        overlaysRef.current.push(marker); storeMarkersRef.current.push(marker);
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
  }, [apiKey, colourTheme, coverage, liveUserLabel, mapId, projectId, selectedCapturer, variant]);

  useEffect(() => () => {
    zoomListenerRef.current?.remove?.();
    placeListenerRef.current?.remove?.();
    placeListenerRef.current = null;
    searchControlRef.current?.remove();
    searchControlRef.current = null;
    zoomListenerRef.current = null;
    for (const overlay of overlaysRef.current) { if (typeof overlay.setMap === 'function') overlay.setMap(null); else overlay.map = null; }
    overlaysRef.current = [];
    roadLinesRef.current = [];
    storeMarkersRef.current = [];
    for (const url of photoUrlsRef.current) URL.revokeObjectURL(url);
    photoUrlsRef.current = [];
    if (locationMarkerRef.current) { if (typeof locationMarkerRef.current.setMap === 'function') locationMarkerRef.current.setMap(null); else locationMarkerRef.current.map = null; }
    locationMarkerRef.current = null;
    locationAccuracyRef.current?.setMap?.(null); locationAccuracyRef.current = null;
    if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current);
    locationWatchRef.current = null; latestLocationRef.current = null;
    locationControlRef.current?.remove(); locationControlRef.current = null;
  }, []);

  const toggleColour = (colour: CoverageColour) => {
    setVisibleColours((current) => ({ ...current, [colour]: !current[colour] }));
  };

  const coverageControls = variant !== 'field' && controlsVisible ? <div className={styles.coverageControls} aria-label="Coverage layer controls">
    <button type="button" className={effectiveCoverageVisible ? styles.controlActive : ''} onClick={() => setCoverageVisible((current) => !current)} aria-pressed={effectiveCoverageVisible}>Coverage {effectiveCoverageVisible ? 'on' : 'off'}</button>
    {(Object.keys(coverageLabels) as CoverageColour[]).map((colour) => <button key={colour} type="button" className={effectiveCoverageVisible && visibleColours[colour] ? styles.controlActive : ''} onClick={() => toggleColour(colour)} aria-pressed={effectiveCoverageVisible && visibleColours[colour]} disabled={!effectiveCoverageVisible}><i className={styles[colour]}/>{coverageLabels[colour]}</button>)}
    <button type="button" className={storesVisible ? styles.controlActive : ''} onClick={() => setStoresVisible((current) => !current)} aria-pressed={storesVisible}><i className={storeStyles.storeDot}/>Captured stores</button>
    <select className={storeStyles.capturerFilter} aria-label="Filter captured stores by capturer" value={selectedCapturer} onChange={(event) => setSelectedCapturer(event.target.value)}><option value="ALL">All capturers</option>{coverage?.storeInsights?.capturers.map((capturer) => <option key={capturer.userId} value={capturer.userId}>{capturer.name} ({capturer.captures})</option>)}</select>
    {variant === 'dashboard' ? <a className={styles.expandMap} href="/projects/demo/map" aria-label="Expand project map">⤢ Expand map</a> : null}
  </div> : null;

  return <section className={`${styles.frame} ${expanded ? styles.expanded : ''}`} data-variant={variant} data-header={showHeader ? 'true' : 'false'} aria-label="Shared project street coverage map">
    {showHeader ? <div className={styles.header}><div><p>Project-shared street coverage</p><h2>Walked streets and outstanding gaps</h2></div>{coverage ? <span>{coverage.summary.coveredSegments} complete · {coverage.summary.partialSegments} partial · {coverage.summary.uncoveredSegments} outstanding</span> : null}</div> : null}
    {apiKey ? <>
      <div ref={hostRef} className={styles.canvas} />
      {controlsHost && coverageControls ? createPortal(coverageControls, controlsHost) : null}
      {variant === 'field' ? <div className={styles.fieldMapActions} aria-label="Field map actions">
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-pressed={expanded}>{expanded ? '↙ Close expanded map' : '⤢ Expand map'}</button>
        {captureHref ? <a href={captureHref}>＋ Capture store</a> : null}
      </div> : null}
    </> : <div className={styles.fallback}>Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to display the street geometry.</div>}
    <div className={styles.legend}><span><i className={styles.green}/>Walked</span><span><i className={styles.amber}/>Unresolved</span><span><i className={styles.red}/>Not walked</span><span><i className={storeStyles.todayDot}/>Correct today</span><span><i className={storeStyles.storeDot}/>Correct earlier</span>{coverage ? <><span className={styles.mapMetric}><strong>{coverage.summary.walkedPercent ?? 0}%</strong> roads walked</span><span className={styles.mapMetric}><strong>{coverage.summary.capturedStoreCount ?? 0}</strong> stores captured · {coverage.summary.capturedStoreScope === 'ALL_PROJECT_USERS' ? 'all users' : 'you'}</span></> : null}<b>{usesOpenStreetMap ? 'Street geometry © OpenStreetMap contributors · ' : ''}Project boundary and shared coverage · refreshes every 15 seconds</b></div>
    {variant !== 'field' && coverage?.storeInsights ? <div className={storeStyles.insights}><span><b>{coverage.storeInsights.correctCaptures}</b> correct stores</span><span><b>{coverage.storeInsights.capturedToday}</b> today</span><span><b>{coverage.storeInsights.densityPerSquareKm ?? '—'}</b> stores/km²</span><span><b>{coverage.storeInsights.statusCounts['SUBMITTED'] ?? 0}</b> in review</span><span><b>{coverage.storeInsights.statusCounts['REJECTED'] ?? 0}</b> rejected</span>{coverage.storeInsights.brandPerformance.slice(0, 3).map((item) => <span key={item.brand}><b>{item.stores}</b> {item.brand}</span>)}</div> : null}
    {error ? <p className={styles.error}>{error}</p> : null}
  </section>;
}
