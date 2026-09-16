'use client';

import { useState } from 'react';
import ProjectCoverageMap, { type CoverageMapType } from '../../../../components/ProjectCoverageMap';

type ToolbarClasses = Readonly<{
  mapToolbar: string | undefined;
  mapTypes: string | undefined;
  selected: string | undefined;
  mapTools: string | undefined;
}>;

const mapTypes: ReadonlyArray<readonly [CoverageMapType, string]> = [
  ['roadmap', 'Map'], ['satellite', 'Satellite'], ['hybrid', 'Hybrid'], ['terrain', 'Terrain'],
];

export default function ProjectGoogleMap({ classes }: { classes: ToolbarClasses }) {
  const [mapType, setMapType] = useState<CoverageMapType>('roadmap');
  const [coverageLayerVisible, setCoverageLayerVisible] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [locateRequest, setLocateRequest] = useState(0);

  const enterFullscreen = (button: HTMLButtonElement) => {
    const panel = button.closest('section');
    if (panel?.requestFullscreen) void panel.requestFullscreen();
  };

  return <>
    <div className={classes.mapToolbar}>
      <div className={classes.mapTypes} aria-label="Map type">
        {mapTypes.map(([value, label]) => <button key={value} type="button" className={mapType === value ? classes.selected : ''} onClick={() => setMapType(value)} aria-pressed={mapType === value}>{label}</button>)}
      </div>
      <div className={classes.mapTools}>
        <button type="button" className={coverageLayerVisible ? classes.selected : ''} onClick={() => setCoverageLayerVisible((current) => !current)} aria-pressed={coverageLayerVisible}>▱ Layers</button>
        <button type="button" className={filtersVisible ? classes.selected : ''} onClick={() => setFiltersVisible((current) => !current)} aria-pressed={filtersVisible}>▽ Filter</button>
        <button type="button" onClick={() => setLocateRequest((current) => current + 1)}>⌾ Locate</button>
        <button type="button" onClick={(event) => enterFullscreen(event.currentTarget)} aria-label="Open map fullscreen">⛶</button>
      </div>
    </div>
    <ProjectCoverageMap projectId="prj_soweto_retail_universe" variant="project" showHeader={false} mapType={mapType} coverageLayerVisible={coverageLayerVisible} controlsVisible={filtersVisible} locateRequest={locateRequest} />
  </>;
}
