'use client';

import ProjectCoverageMap from '../../../components/ProjectCoverageMap';

export default function SharedStreetCoverageMap({ projectId, refreshKey, captureHref }: { projectId: string; refreshKey: number; captureHref?: string }) {
  return <ProjectCoverageMap projectId={projectId} refreshKey={refreshKey} variant="field" {...(captureHref ? { captureHref } : {})} />;
}
