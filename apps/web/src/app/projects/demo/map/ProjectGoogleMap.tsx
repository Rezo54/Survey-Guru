'use client';

import { useEffect, useRef, useState } from 'react';
import ProjectCoverageMap, { type CoverageMapType } from '../../../../components/ProjectCoverageMap';
import { fieldApiOrigin, getFieldToken } from '../../../field/map/field-api';

type ToolbarClasses = Readonly<{
  mapToolbar: string | undefined;
  mapTypes: string | undefined;
  selected: string | undefined;
  mapTools: string | undefined;
}>;

const mapTypes: ReadonlyArray<readonly [CoverageMapType, string]> = [
  ['roadmap', 'Map'], ['satellite', 'Satellite'], ['hybrid', 'Hybrid'], ['terrain', 'Terrain'],
];

export default function ProjectGoogleMap({ classes, projectId }: { classes: ToolbarClasses; projectId: string }) {
  const [mapType, setMapType] = useState<CoverageMapType>('roadmap');
  const [coverageLayerVisible, setCoverageLayerVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [locateRequest, setLocateRequest] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportStatuses, setExportStatuses] = useState('');
  const preferencesLoadedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('survey-guru:project-map-toolbar');
      if (saved) {
        const preferences = JSON.parse(saved) as { mapType?: CoverageMapType; coverageLayerVisible?: boolean; filtersVisible?: boolean };
        if (preferences.mapType && mapTypes.some(([value]) => value === preferences.mapType)) setMapType(preferences.mapType);
        if (typeof preferences.coverageLayerVisible === 'boolean') setCoverageLayerVisible(preferences.coverageLayerVisible);
        if (typeof preferences.filtersVisible === 'boolean') setFiltersVisible(preferences.filtersVisible);
      }
    } catch {
      // Invalid session preferences should not block the project map.
    }
    preferencesLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!preferencesLoadedRef.current) return;
    try {
      window.sessionStorage.setItem('survey-guru:project-map-toolbar', JSON.stringify({ mapType, coverageLayerVisible, filtersVisible }));
    } catch {
      // Controls remain functional when session storage is unavailable.
    }
  }, [coverageLayerVisible, filtersVisible, mapType]);

  const enterFullscreen = (button: HTMLButtonElement) => {
    const panel = button.closest('section');
    if (panel?.requestFullscreen) void panel.requestFullscreen();
  };

  async function downloadStoreReport() {
    setExporting(true);
    try {
      const token = await getFieldToken();
      const statusQuery = exportStatuses ? `?status=${encodeURIComponent(exportStatuses)}` : '';
      const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/${encodeURIComponent(projectId)}/store-captures/export.xlsx${statusQuery}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { message?: string }; throw new Error(result.message ?? 'The Excel report could not be downloaded.'); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${projectId}-store-captures.xlsx`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'The Excel report could not be downloaded.'); }
    finally { setExporting(false); }
  }

  return <>
    <div className={classes.mapToolbar}>
      <div className={classes.mapTypes} aria-label="Map type">
        {mapTypes.map(([value, label]) => <button key={value} type="button" className={mapType === value ? classes.selected : ''} onClick={() => setMapType(value)} aria-pressed={mapType === value}>{label}</button>)}
      </div>
      <div className={classes.mapTools}>
        <button type="button" className={coverageLayerVisible ? classes.selected : ''} onClick={() => setCoverageLayerVisible((current) => !current)} aria-pressed={coverageLayerVisible}>▱ Layers</button>
        <button type="button" className={filtersVisible ? classes.selected : ''} onClick={() => setFiltersVisible((current) => !current)} aria-pressed={filtersVisible}>▽ Filter</button>
        <button type="button" onClick={() => setLocateRequest((current) => current + 1)}>⌾ Locate</button>
        <select aria-label="Store report status" value={exportStatuses} onChange={(event) => setExportStatuses(event.target.value)}><option value="">All store statuses</option><option value="READY_FOR_EXPORT,SYNCED">Correct captures</option><option value="SUBMITTED,NEEDS_REVIEW">In review or redo</option><option value="REJECTED">Rejected stores</option></select>
        <button type="button" onClick={() => void downloadStoreReport()} disabled={exporting}>{exporting ? 'Preparing…' : '⇩ Excel'}</button>
        <button type="button" onClick={(event) => enterFullscreen(event.currentTarget)} aria-label="Open map fullscreen">⛶</button>
      </div>
    </div>
    <ProjectCoverageMap projectId={projectId} variant="project" showHeader={false} mapType={mapType} coverageLayerVisible={coverageLayerVisible} controlsVisible={filtersVisible} locateRequest={locateRequest} />
  </>;
}
