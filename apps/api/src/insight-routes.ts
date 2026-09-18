import { summariseStoreEvidence } from './store-insights.js';
import { productEvidence } from '../../../packages/domain/src/product-evidence.js';
import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
export function registerInsightRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string }; Querystring: { area?: string; date?: string } }>('/api/v1/projects/:projectId/insights', async request => {
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
    const questions = project.get('storeCaptureForm')?.questions ?? [];
    const timeZone = project.get('timeZone') ?? 'Africa/Johannesburg';
    const day = (value: string) => { const d=new Date(value); if(!Number.isFinite(d.getTime()))return '';const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-'); };
    const reviewDate = request.query.date || day(new Date().toISOString());
    if(!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) throw new AuthorisationError('Choose a review date in YYYY-MM-DD format.');
    const dailyReview=captures.filter(d=>day(d.get('submittedAt')??d.get('createdAt')??'')===reviewDate).map(d=>({id:d.id,name:d.get('observedName')??'Unnamed store',status:d.get('status'),awaitingQa:d.get('qaReviewRequested')===true,photoCount:Array.isArray(d.get('photos'))?d.get('photos').length:0,products:productEvidence(d.get('answers')??{}, questions),answers:d.get('answers')??{}}));
    const statuses: Record<string, number> = {}; const brands = new Map<string, number>();
    for (const capture of captures) {
      const status = String(capture.get('status')); statuses[status] = (statuses[status] ?? 0) + 1;
      if (!['VERIFIED','READY_FOR_EXPORT','SYNCED'].includes(status) || capture.get('qaReviewRequested') === true) continue;
      const products = productEvidence(capture.get('answers') ?? {}, questions);
      const names = new Set<string>(Array.isArray(products) ? products.map(p => p?.brand).filter((b): b is string => typeof b === 'string') : []);
      for (const brand of names) brands.set(brand, (brands.get(brand) ?? 0) + 1);
    }
    const accepted = captures.filter(d=>['VERIFIED','READY_FOR_EXPORT','SYNCED'].includes(d.get('status')) && d.get('qaReviewRequested')!==true).length;
    return { project: { id: project.id, name: project.get('name'), areaSquareKm: project.get('boundaryAreaSquareKm') ?? null },
      selectedArea: request.query.area ?? null, areas: areas.map(d => ({ id: d.id, name: d.get('name'), reviewState: d.get('reviewState') })),
      metrics: { submittedCustomers: captures.length, acceptedCustomers: accepted, awaitingQa: captures.filter(d => d.get('status') === 'SUBMITTED' || d.get('qaReviewRequested') === true).length,
        activeAgents: new Set(assignments.filter(d => d.get('status') === 'active').map(d => d.get('assignedUserId'))).size,
        submittedAreas: areas.filter(d => d.get('reviewState') === 'SUBMITTED' && (!request.query.area || d.id === request.query.area)).length },
      statusCounts: statuses, brandPerformance: [...brands].sort((a,b) => b[1] - a[1]).map(([brand, stores]) => ({ brand, stores })),
      fieldActivity: sessionsSnapshot.docs.filter(d => d.get('workspaceId') === authority.workspaceId && assignmentIds.has(d.get('assignmentId'))).map(d => ({ id: d.id, areaName: d.get('areaName'), state: d.get('state'), acceptedPoints: d.get('acceptedEvidenceCount') ?? 0, lastEvidenceAt: d.get('lastEvidenceAt') ?? null })),
      dailyReview, reviewDate, timeZone,
      storeInsights: summariseStoreEvidence(captures.map(d=>({id:d.id,accepted:['VERIFIED','READY_FOR_EXPORT','SYNCED'].includes(d.get('status'))&&d.get('qaReviewRequested')!==true,day:day(d.get('submittedAt')??d.get('createdAt')??''),products:productEvidence(d.get('answers')??{},questions)})),reviewDate),
      generatedAt: new Date().toISOString() };
  });
}
