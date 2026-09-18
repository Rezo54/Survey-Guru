import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
export function registerInsightRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string }; Querystring: { area?: string } }>('/api/v1/projects/:projectId/insights', async request => {
    const identity = await verifyRequestIdentity(request); const authority = await resolveAuthority(identity);
    if (!authority.permissions.has('report.read') && !authority.permissions.has('opportunity.read')) throw new AuthorisationError('Insights permission is required.');
    requireProjectScope(authority, request.params.projectId);
    const { firestore } = getFirebaseAdminServices();
    const project = await firestore.collection('projects').doc(request.params.projectId).get();
    if (!project.exists || project.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Project is outside this workspace.');
    const [areasSnapshot, assignmentsSnapshot, capturesSnapshot, sessionsSnapshot] = await Promise.all([
      firestore.collection('projectAreas').where('projectId', '==', project.id).get(),
      firestore.collection('assignments').where('projectId', '==', project.id).get(),
      firestore.collection('storeCaptures').where('projectId', '==', project.id).get(),
      firestore.collection('searchSessions').where('projectId', '==', project.id).get(),
    ]);
    const isSupervisorOnly = authority.permissions.has('supervisor.review') && !authority.permissions.has('workspace.admin') && !authority.permissions.has('qa.review');
    const areas = areasSnapshot.docs.filter(d => d.get('workspaceId') === authority.workspaceId && (!isSupervisorOnly || (d.get('supervisorIds') ?? []).includes(identity.uid)));
    if (request.query.area && !areas.some(d => d.id === request.query.area)) throw new AuthorisationError('Area is outside your assigned scope.');
    const areaIds = new Set(areas.map(d => d.id));
    const assignments = assignmentsSnapshot.docs.filter(d => d.get('workspaceId') === authority.workspaceId && (!request.query.area || d.get('areaId') === request.query.area) && (!isSupervisorOnly || areaIds.has(d.get('areaId'))));
    const assignmentIds = new Set(assignments.map(d => d.id));
    const captures = capturesSnapshot.docs.filter(d => d.get('workspaceId') === authority.workspaceId && d.get('status') !== 'DRAFT' && ((!request.query.area && !isSupervisorOnly) || assignmentIds.has(d.get('assignmentId'))));
    const statuses: Record<string, number> = {}; const brands = new Map<string, number>();
    for (const capture of captures) {
      const status = String(capture.get('status')); statuses[status] = (statuses[status] ?? 0) + 1;
      const products = capture.get('answers')?.brandProducts;
      const names = new Set<string>(Array.isArray(products) ? products.map(p => p?.brand).filter((b): b is string => typeof b === 'string') : []);
      for (const brand of names) brands.set(brand, (brands.get(brand) ?? 0) + 1);
    }
    const accepted = ['VERIFIED', 'READY_FOR_EXPORT', 'SYNCED'].reduce((sum, status) => sum + (statuses[status] ?? 0), 0);
    return { project: { id: project.id, name: project.get('name'), areaSquareKm: project.get('boundaryAreaSquareKm') ?? null },
      selectedArea: request.query.area ?? null, areas: areas.map(d => ({ id: d.id, name: d.get('name'), reviewState: d.get('reviewState') })),
      metrics: { submittedCustomers: captures.length, acceptedCustomers: accepted, awaitingQa: captures.filter(d => d.get('status') === 'SUBMITTED' || d.get('qaReviewRequested') === true).length,
        activeAgents: new Set(assignments.filter(d => d.get('status') === 'active').map(d => d.get('assignedUserId'))).size,
        submittedAreas: areas.filter(d => d.get('reviewState') === 'SUBMITTED' && (!request.query.area || d.id === request.query.area)).length },
      statusCounts: statuses, brandPerformance: [...brands].sort((a,b) => b[1] - a[1]).map(([brand, stores]) => ({ brand, stores })),
      fieldActivity: sessionsSnapshot.docs.filter(d => d.get('workspaceId') === authority.workspaceId && assignmentIds.has(d.get('assignmentId'))).map(d => ({ id: d.id, areaName: d.get('areaName'), state: d.get('state'), acceptedPoints: d.get('acceptedEvidenceCount') ?? 0, lastEvidenceAt: d.get('lastEvidenceAt') ?? null })),
      generatedAt: new Date().toISOString() };
  });
}
