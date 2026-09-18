import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, requirePermission, requireProjectScope, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { ProjectSetupRequestError } from './project-setup-routes.js';

export const rolePermissions = {
  field_worker: ['project.read', 'assignment.read', 'field.capture', 'coverage.read'],
  supervisor: ['project.read', 'assignment.read', 'coverage.read', 'supervisor.review', 'report.read'],
  qa: ['project.read', 'coverage.read', 'qa.review', 'report.read'],
  analyst: ['project.read', 'coverage.read', 'opportunity.read', 'report.read'],
} as const;
const assignablePermissions = new Set([...Object.values(rolePermissions).flat(), 'workspace.admin', 'export.data']);
function text(value: unknown, name: string, maximum = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new ProjectSetupRequestError(`${name} is required (maximum ${maximum} characters).`);
  return value.trim();
}
async function context(request: Parameters<typeof verifyRequestIdentity>[0]) {
  const identity = await verifyRequestIdentity(request);
  return { identity, authority: await resolveAuthority(identity), ...getFirebaseAdminServices() };
}
export function registerOperationsRoutes(app: FastifyInstance, loadContext: typeof context = context) {
  app.get('/api/v1/admin/people', async request => {
    const { authority, firestore, auth } = await loadContext(request); requirePermission(authority, 'platform.admin');
    const [members, roles, accounts] = await Promise.all([
      firestore.collection('workspaceMemberships').where('workspaceId', '==', authority.workspaceId).get(),
      firestore.collection('roleDefinitions').get(), auth.listUsers(1000),
    ]);
    const known = new Map(members.docs.map(d => [d.get('userId'), d.get('roleKey')]));
    return { people: accounts.users.filter(u => !u.disabled).map(u => ({ id: u.uid, email: u.email ?? '', name: u.displayName ?? '', roleKey: known.get(u.uid) ?? null })),
      moreAccountsAvailable: Boolean(accounts.pageToken),
      roles: [...Object.entries(rolePermissions).map(([key, permissions]) => ({ key, name: key.replaceAll('_', ' '), permissions })), ...roles.docs.filter(d => d.get('workspaceId') === authority.workspaceId).map(d => ({ key: d.id, name: d.get('name'), permissions: d.get('permissions') }))],
      assignablePermissions: [...assignablePermissions] };
  });
  app.post<{ Body: { name?: unknown; permissions?: unknown } }>('/api/v1/admin/roles', async request => {
    const { identity, authority, firestore } = await loadContext(request); requirePermission(authority, 'platform.admin');
    const name = text(request.body?.name, 'Role name', 60);
    const permissions = request.body?.permissions;
    if (!Array.isArray(permissions) || !permissions.length || permissions.some(p => typeof p !== 'string' || !assignablePermissions.has(p))) throw new ProjectSetupRequestError('Select supported permissions.');
    const key = `${authority.workspaceId}_${randomUUID()}`;
    await firestore.collection('roleDefinitions').doc(key).create({ name, permissions: [...new Set(permissions)], workspaceId: authority.workspaceId, createdBy: identity.uid, createdAt: new Date().toISOString() });
    return { roleKey: key, name };
  });
  app.post<{ Params: { userId: string }; Body: { roleKey?: unknown } }>('/api/v1/admin/people/:userId/role', async request => {
    const { identity, authority, firestore, auth } = await loadContext(request); requirePermission(authority, 'platform.admin');
    if (request.params.userId === identity.uid) throw new ProjectSetupRequestError('Use another super administrator to change your own access.');
    const roleKey = text(request.body?.roleKey, 'Role');
    const preset = rolePermissions[roleKey as keyof typeof rolePermissions];
    const role = await firestore.collection('roleDefinitions').doc(roleKey).get();
    if (!preset && (!role.exists || role.get('workspaceId') !== authority.workspaceId)) throw new AuthorisationError('Role is outside this workspace.');
    const user = await auth.getUser(request.params.userId);
    if (user.disabled || !user.email) throw new ProjectSetupRequestError('Select an enabled account with an email address.');
    const memberships = await firestore.collection('workspaceMemberships').where('userId', '==', user.uid).get();
    if (memberships.docs.some(d => d.get('workspaceId') !== authority.workspaceId && d.get('status') === 'active')) throw new ProjectSetupRequestError('This account already belongs to another workspace.');
    const existing = memberships.docs.find(d => d.get('workspaceId') === authority.workspaceId);
    const batch = firestore.batch();
    if (preset && !role.exists) batch.set(firestore.collection('roleDefinitions').doc(roleKey), { name: roleKey, permissions: [...preset] });
    batch.set(firestore.collection('users').doc(user.uid), { email: user.email, displayName: user.displayName ?? null, status: 'active' }, { merge: true });
    batch.set(existing?.ref ?? firestore.collection('workspaceMemberships').doc(`wsm_${user.uid}`), { userId: user.uid, workspaceId: authority.workspaceId, roleKey, status: 'active', activatedBy: identity.uid, updatedAt: new Date().toISOString() }, { merge: true });
    await batch.commit(); return { userId: user.uid, roleKey };
  });

  app.get('/api/v1/operations', async request => {
    const { identity, authority, firestore } = await loadContext(request);
    if (!['workspace.admin', 'supervisor.review', 'qa.review'].some(p => authority.permissions.has(p as never))) throw new AuthorisationError('Operations access is required.');
    const administrator = authority.permissions.has('workspace.admin');
    const qa = authority.permissions.has('qa.review');
    const [projects, areas, assignments, members] = await Promise.all([
      firestore.collection('projects').where('workspaceId', '==', authority.workspaceId).get(),
      firestore.collection('projectAreas').where('workspaceId', '==', authority.workspaceId).get(),
      firestore.collection('assignments').where('workspaceId', '==', authority.workspaceId).get(),
      administrator ? firestore.collection('workspaceMemberships').where('workspaceId', '==', authority.workspaceId).where('status', '==', 'active').get() : null,
    ]);
    const visibleAreas = areas.docs.filter(d => authority.projectIds.has(d.get('projectId')) && (administrator || qa || (d.get('supervisorIds') ?? []).includes(identity.uid)));
    const ids = new Set(visibleAreas.map(d => d.id));
    const people = await Promise.all((members?.docs ?? []).map(async d => {
      const [user, role] = await Promise.all([firestore.collection('users').doc(d.get('userId')).get(), firestore.collection('roleDefinitions').doc(d.get('roleKey')).get()]);
      return { id: d.get('userId'), name: user.get('displayName') ?? user.get('email') ?? d.get('userId'), permissions: role.get('permissions') ?? [] };
    }));
    return { canManage: administrator, canReview: qa, canSubmit: authority.permissions.has('supervisor.review'),
      projects: projects.docs.filter(d => d.get('status') === 'active' && authority.projectIds.has(d.id)).map(d => ({ id: d.id, name: d.get('name') })),
      areas: visibleAreas.map(d => ({ id: d.id, ...d.data() })), people,
      assignments: assignments.docs.filter(d => authority.projectIds.has(d.get('projectId')) && (administrator || qa || ids.has(d.get('areaId')))).map(d => ({ id: d.id, ...d.data() })) };
  });
  app.post<{ Body: { projectId?: unknown; name?: unknown } }>('/api/v1/operations/areas', async request => {
    const { identity, authority, firestore } = await loadContext(request); requirePermission(authority, 'workspace.admin');
    const projectId = text(request.body?.projectId, 'Project'); requireProjectScope(authority, projectId);
    const project = await firestore.collection('projects').doc(projectId).get();
    if (project.get('workspaceId') !== authority.workspaceId || project.get('status') !== 'active') throw new AuthorisationError('Active project required.');
    const ref = firestore.collection('projectAreas').doc();
    await ref.create({ workspaceId: authority.workspaceId, projectId, name: text(request.body?.name, 'Area name'), boundary: project.get('boundary') ?? null,
      boundaryScope: 'PROJECT', supervisorIds: [], reviewState: 'IN_FIELD', createdAt: new Date().toISOString(), createdBy: identity.uid });
    return { areaId: ref.id };
  });
  app.post<{ Params: { areaId: string }; Body: { userId?: unknown; kind?: unknown } }>('/api/v1/operations/areas/:areaId/assign', async request => {
    const { identity, authority, firestore } = await loadContext(request); requirePermission(authority, 'workspace.admin');
    const userId = text(request.body?.userId, 'User'); const kind = request.body?.kind;
    if (kind !== 'field' && kind !== 'supervisor') throw new ProjectSetupRequestError('Select field agent or supervisor.');
    const memberships = await firestore.collection('workspaceMemberships').where('workspaceId', '==', authority.workspaceId).where('userId', '==', userId).where('status', '==', 'active').get();
    const membership = memberships.docs[0]; if (!membership) throw new AuthorisationError('Activate this person and assign a role first.');
    const role = await firestore.collection('roleDefinitions').doc(membership.get('roleKey')).get();
    if (!(role.get('permissions') ?? []).includes(kind === 'field' ? 'field.capture' : 'supervisor.review')) throw new ProjectSetupRequestError('The selected role does not permit this assignment.');
    const areaRef = firestore.collection('projectAreas').doc(request.params.areaId);
    const id = `asg_${randomUUID()}`; const now = new Date().toISOString();
    await firestore.runTransaction(async tx => {
      const area = await tx.get(areaRef); const projectId = area.get('projectId');
      if (!area.exists || area.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Area is outside this workspace.');
      requireProjectScope(authority, projectId);
      const project = await tx.get(firestore.collection('projects').doc(projectId));
      if (project.get('status') !== 'active') throw new AuthorisationError('Project is not active.');
      const existing = await tx.get(firestore.collection('assignments').where('workspaceId', '==', authority.workspaceId).where('areaId', '==', area.id).where('assignedUserId', '==', userId).where('status', '==', 'active'));
      if (kind === 'field' && !existing.empty) return;
      tx.set(firestore.collection('projectMemberships').doc(`prjm_${projectId}_${userId}`), { userId, projectId, workspaceId: authority.workspaceId, status: 'active' }, { merge: true });
      if (kind === 'supervisor') { tx.update(areaRef, { supervisorIds: [...new Set([...(area.get('supervisorIds') ?? []), userId])] }); return; }
      tx.create(firestore.collection('assignments').doc(id), { workspaceId: authority.workspaceId, projectId, areaId: area.id, areaName: area.get('name'), assignedUserId: userId,
        coveragePolicyId: project.get('coveragePolicyId'), teamId: userId, teamName: userId, status: 'active', assignmentType: 'coverage_search', assignedAt: now, assignedBy: identity.uid, outstandingKm: 0 });
    });
    return { assigned: true };
  });
  app.post<{ Params: { assignmentId: string } }>('/api/v1/operations/assignments/:assignmentId/unassign', async request => {
    const { identity, authority, firestore } = await loadContext(request); requirePermission(authority, 'workspace.admin');
    await firestore.runTransaction(async tx => {
      const ref = firestore.collection('assignments').doc(request.params.assignmentId); const assignment = await tx.get(ref);
      if (!assignment.exists || assignment.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Assignment is outside this workspace.');
      const sessions = await tx.get(firestore.collection('searchSessions').where('assignmentId', '==', ref.id));
      const userId = assignment.get('assignedUserId'); const projectId = assignment.get('projectId');
      const otherAssignments = await tx.get(firestore.collection('assignments').where('workspaceId', '==', authority.workspaceId).where('projectId', '==', projectId).where('assignedUserId', '==', userId).where('status', '==', 'active'));
      const areas = await tx.get(firestore.collection('projectAreas').where('workspaceId', '==', authority.workspaceId).where('projectId', '==', projectId));
      const now = new Date().toISOString();
      tx.update(ref, { status: 'inactive', unassignedAt: now, unassignedBy: identity.uid });
      for (const session of sessions.docs) tx.update(session.ref, { state: 'CLOSED', updatedAt: now });
      if (!otherAssignments.docs.some(d => d.id !== ref.id) && !areas.docs.some(d => (d.get('supervisorIds') ?? []).includes(userId))) {
        tx.set(firestore.collection('projectMemberships').doc(`prjm_${projectId}_${userId}`), { status: 'inactive', updatedAt: now }, { merge: true });
      }
    }); return { unassigned: true };
  });
  app.post<{ Params: { areaId: string }; Body: { decision?: unknown; note?: unknown } }>('/api/v1/operations/areas/:areaId/review', async request => {
    const { identity, authority, firestore } = await loadContext(request);
    const decision = request.body?.decision;
    if (!['SUBMIT', 'ACCEPT', 'RETURN'].includes(String(decision))) throw new ProjectSetupRequestError('Invalid review decision.');
    requirePermission(authority, decision === 'SUBMIT' ? 'supervisor.review' : 'qa.review');
    const note = text(request.body?.note, 'Review note', 2000);
    await firestore.runTransaction(async tx => {
      const ref = firestore.collection('projectAreas').doc(request.params.areaId); const area = await tx.get(ref);
      if (!area.exists || area.get('workspaceId') !== authority.workspaceId) throw new AuthorisationError('Area is outside this workspace.');
      requireProjectScope(authority, area.get('projectId'));
      if (decision === 'SUBMIT' && !(area.get('supervisorIds') ?? []).includes(identity.uid) && !authority.permissions.has('workspace.admin')) throw new AuthorisationError('Only the assigned supervisor may submit this area.');
      if (decision !== 'SUBMIT' && area.get('reviewState') !== 'SUBMITTED') throw new ProjectSetupRequestError('The area must be submitted before QA review.');
      if (decision !== 'SUBMIT' && area.get('submittedBy') === identity.uid && !authority.permissions.has('platform.admin')) throw new AuthorisationError('A different QA reviewer must review your submission.');
      const now = new Date().toISOString(); const state = decision === 'SUBMIT' ? 'SUBMITTED' : decision === 'ACCEPT' ? 'ACCEPTED' : 'RETURNED';
      tx.update(ref, { reviewState: state, reviewNote: note, updatedAt: now, ...(decision === 'SUBMIT' ? { submittedBy: identity.uid, submittedAt: now } : { reviewedBy: identity.uid, reviewedAt: now }) });
      tx.create(firestore.collection('areaReviewEvents').doc(), { areaId: area.id, projectId: area.get('projectId'), workspaceId: authority.workspaceId, actorId: identity.uid, decision, note, createdAt: now });
    }); return { recorded: true };
  });
}
