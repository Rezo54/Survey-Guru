'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProjectCoverageMap, { type CoverageMapType } from '../../../../components/ProjectCoverageMap';
import { fieldApiOrigin, getFieldToken } from '../../../field/map/field-api';

type ToolbarClasses = Readonly<{
  mapToolbar: string | undefined;
  mapTypes: string | undefined;
  projectChooser: string | undefined;
  baseMapTypes: string | undefined;
  selected: string | undefined;
  mapTools: string | undefined;
}>;

const mapTypes: ReadonlyArray<readonly [CoverageMapType, string]> = [
  ['roadmap', 'Map'], ['satellite', 'Satellite'], ['hybrid', 'Hybrid'], ['terrain', 'Terrain'],
];
type ActiveProject = { id: string; name: string; status: 'active'; publishedAt?: string | null };

export default function ProjectGoogleMap({ classes, projectId }: { classes: ToolbarClasses; projectId: string }) {
  const [activeProjectId, setActiveProjectId] = useState(projectId);
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [canCreateProjects, setCanCreateProjects] = useState(false);
  const [mapType, setMapType] = useState<CoverageMapType>('roadmap');
  const [coverageLayerVisible, setCoverageLayerVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [locateRequest, setLocateRequest] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportStatuses, setExportStatuses] = useState('');
  const preferencesLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getFieldToken();
        const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/active`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await response.json() as { projects?: ActiveProject[]; authority?: { canCreateProjects?: boolean }; message?: string };
        if (!response.ok || !Array.isArray(body.projects)) throw new Error(body.message ?? 'Active projects are unavailable.');
        if (cancelled) return;
        setProjects(body.projects);
        setCanCreateProjects(body.authority?.canCreateProjects === true);
        const saved = window.sessionStorage.getItem('survey-guru:active-project');
        const next = body.projects.some((project) => project.id === projectId) ? projectId : saved && body.projects.some((project) => project.id === saved) ? saved : body.projects[0]?.id;
        if (next) setActiveProjectId(next);
      } catch { if (!cancelled) setProjects([]); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    window.sessionStorage.setItem('survey-guru:active-project', activeProjectId);
    const url = new URL(window.location.href); url.searchParams.set('project', activeProjectId); window.history.replaceState({}, '', url);
  }, [activeProjectId]);

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
      const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/${encodeURIComponent(activeProjectId)}/store-captures/export.xlsx${statusQuery}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { message?: string }; throw new Error(result.message ?? 'The Excel report could not be downloaded.'); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${activeProjectId}-store-captures.xlsx`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'The Excel report could not be downloaded.'); }
    finally { setExporting(false); }
  }

  return <>
    <div className={classes.mapToolbar}>
      <div className={classes.mapTypes}>
        <div className={classes.projectChooser} aria-label="Active project">
          <select aria-label="Active project" value={activeProjectId} onChange={(event) => setActiveProjectId(event.target.value)} disabled={!projects.length}>{projects.length ? projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>) : <option value={activeProjectId}>Loading projects…</option>}</select>
          {canCreateProjects ? <Link href="/projects/new">＋ New project area</Link> : null}
        </div>
        <div className={classes.baseMapTypes} aria-label="Map type">{mapTypes.map(([value, label]) => <button key={value} type="button" className={mapType === value ? classes.selected : ''} onClick={() => setMapType(value)} aria-pressed={mapType === value}>{label}</button>)}</div>
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
    <ProjectCoverageMap projectId={activeProjectId} variant="project" showHeader={false} mapType={mapType} coverageLayerVisible={coverageLayerVisible} controlsVisible={filtersVisible} locateRequest={locateRequest} />
  </>;
}
