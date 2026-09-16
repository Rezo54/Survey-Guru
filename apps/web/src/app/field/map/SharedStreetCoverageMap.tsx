'use client';

import ProjectCoverageMap from '../../../components/ProjectCoverageMap';

export default function SharedStreetCoverageMap({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  return <ProjectCoverageMap projectId={projectId} refreshKey={refreshKey} variant="field" />;
}
