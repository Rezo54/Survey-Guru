'use client';

import { useEffect, useState } from 'react';
import ProjectCoverageMap from '../../components/ProjectCoverageMap';
import { fieldApiOrigin, getFieldToken } from '../field/map/field-api';
import styles from './dashboard-project-selector.module.css';

type ActiveProject = { id: string; name: string };

export default function DashboardCoverageMap() {
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [projectId, setProjectId] = useState('prj_soweto_retail_universe');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getFieldToken();
        const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/active`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await response.json() as { projects?: ActiveProject[] };
        if (!response.ok || !Array.isArray(body.projects) || cancelled) return;
        setProjects(body.projects);
        const saved = window.sessionStorage.getItem('survey-guru:active-project');
        const next = saved && body.projects.some((project) => project.id === saved) ? saved : body.projects[0]?.id;
        if (next) setProjectId(next);
      } catch { /* The map retains its safe default project when the selector cannot load. */ }
    })();
    return () => { cancelled = true; };
  }, []);

  function selectProject(next: string) {
    setProjectId(next);
    window.sessionStorage.setItem('survey-guru:active-project', next);
  }

  return <div className={styles.shell}>{projects.length ? <label className={styles.selector}>Active project<select value={projectId} onChange={(event) => selectProject(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : null}<ProjectCoverageMap projectId={projectId} variant="dashboard" showHeader={false} /></div>;
}
