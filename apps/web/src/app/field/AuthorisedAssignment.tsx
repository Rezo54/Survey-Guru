'use client';

import { useEffect, useState } from 'react';
import { fieldApiOrigin, getFieldToken } from './map/field-api';
import SearchSessionLauncher from './SearchSessionLauncher';
import styles from './field-today.module.css';

type Assignment = { id: string; projectId?: string; projectName?: string; areaName?: string; assignmentType?: string; teamName?: string; evidenceState?: string; targetState?: string; outstandingKm?: number; scheduledWindow?: string };
type AssignmentResponse = { assignments?: Assignment[]; error?: string; message?: string };

export default function AuthorisedAssignment() {
  const [result, setResult] = useState<AssignmentResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getFieldToken();
        const response = await fetch(`${fieldApiOrigin()}/api/v1/assignments/today`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const body = await response.json() as AssignmentResponse;
        if (!response.ok) throw new Error(body.message ?? 'Assignments could not be loaded.');
        if (!cancelled) setResult(body);
      } catch (error) {
        if (!cancelled) setResult({ error: 'request_failed', message: error instanceof Error ? error.message : 'Request failed.' });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (!result) return <section className={styles.hero}><div><p className={styles.eyebrow}>Today&apos;s priority</p><h2>Loading your assignments…</h2></div></section>;
  const assignments = result.assignments ?? [];
  if (!assignments.length) return <section className={styles.hero}><div><p className={styles.eyebrow}>Field access</p><h2>No active assignments</h2><p>{result.message ?? 'Your administrator has not assigned an active project area to this account.'}</p></div></section>;
  const priority = assignments[0]!;

  return <>
    <section className={styles.hero}><div><p className={styles.eyebrow}>Today&apos;s priority · {priority.projectName ?? 'Assigned project'}</p><h2>{priority.areaName ?? 'Assigned area'}</h2><p>Open the assignment to search the authorised geography and capture stores inside its project boundary.</p><div className={styles.heroTags}><span>{priority.assignmentType ?? 'Field assignment'}</span><span>{priority.teamName ?? 'Assigned team'}</span><span>API authorised</span></div></div><div className={styles.heroStat}><strong>{priority.outstandingKm ?? '—'}</strong><span>km remaining</span></div><SearchSessionLauncher assignmentId={priority.id} /></section>
    <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Work queue</p><h2>My active assignments</h2></div><span className={styles.pill}>{assignments.length} active</span></div><div className={styles.list}>{assignments.map((assignment, index) => <div className={styles.assignment} key={assignment.id}><div className={styles.order}>{index + 1}</div><div><strong>{assignment.areaName ?? 'Assigned area'}</strong><span>{assignment.projectName ?? 'Assigned project'} · {assignment.scheduledWindow ?? 'Ready for fieldwork'}</span></div><SearchSessionLauncher assignmentId={assignment.id} compact /></div>)}</div></section>
  </>;
}
