'use client';

import { useEffect, useState } from 'react';
import { fieldApiOrigin, getFieldToken } from '../field/map/field-api';

type CoverageSummary = Readonly<{
  totalSegments: number;
  uncoveredSegments: number;
  partialSegments: number;
  coveredSegments: number;
}>;

type CoverageResponse = Readonly<{
  summary?: CoverageSummary;
  message?: string;
  error?: string;
}>;

function confirmedPercent(summary: CoverageSummary): number {
  return summary.totalSegments > 0 ? Math.round(summary.coveredSegments / summary.totalSegments * 100) : 0;
}

export default function ProjectSummaryCheckpoint({ mode = 'detail' }: { mode?: 'detail' | 'badge' | 'metric' }) {
  const [result, setResult] = useState<CoverageResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCoverageSummary() {
      try {
        const token = await getFieldToken();
        const response = await fetch(`${fieldApiOrigin()}/api/v1/projects/prj_soweto_retail_universe/street-coverage`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        const body = await response.json() as CoverageResponse;
        if (!response.ok) throw new Error(body.message ?? body.error ?? 'Coverage summary is unavailable.');
        if (!cancelled) setResult(body);
      } catch (error) {
        if (!cancelled) setResult({ error: error instanceof Error ? error.message : 'Coverage summary is unavailable.' });
      }
    }
    void loadCoverageSummary();
    const timer = window.setInterval(() => { void loadCoverageSummary(); }, 15_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const summary = result?.summary;
  const percent = summary ? confirmedPercent(summary) : null;

  if (mode === 'metric') return <strong>{percent === null ? '—' : `${percent}%`}</strong>;
  if (mode === 'badge') return <>{percent === null ? '● Loading' : `● ${percent}% confirmed`}</>;
  if (!result) return <small>Loading authoritative street coverage…</small>;
  if (!summary) return <small>Live coverage unavailable · {result.error ?? result.message}</small>;

  return <small>Live coverage API · {summary.coveredSegments.toLocaleString()} complete · {summary.partialSegments.toLocaleString()} partial · {summary.uncoveredSegments.toLocaleString()} outstanding · {percent}% confirmed</small>;
}
