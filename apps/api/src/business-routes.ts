import { membershipRole, membershipRoleKeys } from './membership-roles.js';
import type { FastifyInstance } from 'fastify';
import { verifyRequestIdentity } from './auth.js';
import { AuthorisationError, type AuthorityContext, type SurveyGuruPermission, resolveAuthority } from './authority.js';
import { getFirebaseAdminServices } from './firebase-admin.js';
import { ProjectSetupRequestError } from './project-setup-routes.js';

export function businessAccess(authority: AuthorityContext, workspaceId: string) {
  if (!authority.permissions.has('platform.admin') && !(authority.workspaceId === workspaceId && authority.permissions.has('business.admin'))) throw new AuthorisationError('Business administration is outside your access.');
}
export function businessPermissions(role: unknown, capture: unknown): SurveyGuruPermission[] {
  if (!['viewer', 'admin'].includes(String(role)) || typeof capture !== 'boolean') throw new ProjectSetupRequestError('Choose a business role and capture permission.');
  return ['project.read', 'coverage.read', 'report.read', ...(role === 'admin' ? ['business.admin' as const] : []), ...(capture ? ['field.capture' as const, 'assignment.read' as const] : [])];
}
async function context(request: Parameters<typeof verifyRequestIdentity>[0]) {
  const identity = await verifyRequestIdentity(request);
  return { identity, authority: await resolveAuthority(identity), ...getFirebaseAdminServices() };
}
export function registerBusinessRoutes(app: FastifyInstance, load: typeof context = context) {
  app.get('/api/v1/businesses', async request => {
    const { authority, firestore } = await load(request);
    const platform = authority.permissions.has('platform.admin');
    if (!platform && !authority.permissions.has('business.admin')) throw new AuthorisationError('Business administration required.');
    const result = platform ? await firestore.collection('workspaces').where('kind', '==', 'business').get() : { docs: [await firestore.collection('workspaces').doc(authority.workspaceId).get()] };
    return { canCreate: platform, businesses: result.docs.filter(d => d.exists && d.get('kind') === 'business' && d.get('status') === 'active').map(d => ({ id: d.id, name: d.get('name') })) };
  });
  app.post<{ Body: { name?: unknown } }>('/api/v1/businesses', async request => {
    const { authority, identity, firestore } = await load(request);
    if (!authority.permissions.has('platform.admin')) throw new AuthorisationError('TES super administrator required.');
    const name = request.body?.name;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) throw new ProjectSetupRequestError('Business name is required (maximum 120 characters).');
    const ref = firestore.collection('workspaces').doc();
    await ref.create({ name: name.trim(), kind: 'business', status: 'active', createdBy: identity.uid, createdAt: new Date().toISOString() });
    return { id: ref.id };
  });
  app.get<{ Params: { id: string } }>('/api/v1/businesses/:id', async request => {
    const { authority, firestore } = await load(request); businessAccess(authority, request.params.id);
    const business = await firestore.collection('workspaces').doc(request.params.id).get();
    if (!business.exists || business.get('kind') !== 'business' || business.get('status') !== 'active') throw new AuthorisationError('Active business required.');
    const [members, projects] = await Promise.all([
      firestore.collection('workspaceMemberships').where('workspaceId', '==', business.id).get(),
      firestore.collection('projects').where('workspaceId', '==', business.id).where('status', '==', 'active').get()
    ]);
    const people = await Promise.all(members.docs.map(async d => {
      const [user, role, access] = await Promise.all([firestore.collection('users').doc(d.get('userId')).get(), membershipRole(firestore, d), firestore.collection('projectMemberships').where('workspaceId', '==', business.id).where('userId', '==', d.get('userId')).where('status', '==', 'active').get()]);
      return { id: d.get('userId'), email: user.get('email') ?? '', status: d.get('status'), admin: (role.get('permissions') ?? []).includes('business.admin'), capture: (role.get('permissions') ?? []).includes('field.capture'), projectIds: access.docs.map(p => p.get('projectId')) };
    }));
    return { name: business.get('name'), canAppointAdmin: authority.permissions.has('platform.admin'), people, projects: projects.docs.map(d => ({ id: d.id, name: d.get('name') })) };
  });
  app.post<{ Params: { id: string }; Body: { email?: unknown; role?: unknown; capture?: unknown; active?: unknown; projectIds?: unknown } }>('/api/v1/businesses/:id/people', async request => {
    const { authority, identity, firestore, auth } = await load(request); const workspaceId = request.params.id; businessAccess(authority, workspaceId);
    const { email, role, capture, active, projectIds } = request.body ?? {};
    const permissions = businessPermissions(role, capture);
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof active !== 'boolean' || !Array.isArray(projectIds) || projectIds.length > 100 || projectIds.some(p => typeof p !== 'string' || !p || p.includes('/'))) throw new ProjectSetupRequestError('Provide a valid email, status and project selection.');
    if (role === 'admin' && !authority.permissions.has('platform.admin')) throw new AuthorisationError('Only TES may appoint business administrators.');
    let user;
    try { user = await auth.getUserByEmail(email.trim()); } catch { throw new ProjectSetupRequestError('Ask the employee to request an account first, then add their email here.'); }
    if (user.disabled || user.uid === identity.uid) throw new AuthorisationError('You cannot change your own access or a disabled account.');
    await firestore.runTransaction(async tx => {
      const business = await tx.get(firestore.collection('workspaces').doc(workspaceId));
      if (!business.exists || business.get('kind') !== 'business' || business.get('status') !== 'active') throw new AuthorisationError('Active business required.');
      const memberships = await tx.get(firestore.collection('workspaceMemberships').where('userId', '==', user.uid));
      if (memberships.docs.some(d => d.get('workspaceId') !== workspaceId)) throw new AuthorisationError('This account belongs to another workspace. TES must handle account transfers separately.');
      const existing = memberships.docs.find(d => d.get('workspaceId') === workspaceId);
      if (existing) {
        const oldRole = await membershipRole(firestore, existing, ref => tx.get(ref));
        if ((oldRole.get('permissions') ?? []).some((p: string) => ['platform.admin', 'workspace.admin'].includes(p)) || (!authority.permissions.has('platform.admin') && (oldRole.get('permissions') ?? []).includes('business.admin'))) throw new AuthorisationError('This administrator cannot be changed here.');
      }
      const previous = await tx.get(firestore.collection('projectMemberships').where('userId', '==', user.uid).where('workspaceId', '==', workspaceId));
      for (const id of projectIds as string[]) {
        const project = await tx.get(firestore.collection('projects').doc(id));
        if (!project.exists || project.get('workspaceId') !== workspaceId || project.get('status') !== 'active') throw new AuthorisationError('Project is outside this business.');
      }
      const now = new Date().toISOString(); const roleKey = `${workspaceId}_business_${role}_${capture ? 'capture' : 'read'}`;
      tx.set(firestore.collection('roleDefinitions').doc(roleKey), { workspaceId, name: `Business ${role}${capture ? ' with capture' : ''}`, permissions });
      tx.set(firestore.collection('users').doc(user.uid), { email: user.email, displayName: user.displayName ?? '', status: 'active' }, { merge: true });
      tx.set(existing?.ref ?? firestore.collection('workspaceMemberships').doc(`wsm_${user.uid}`), { workspaceId, userId: user.uid, roleKey, roleKeys: [roleKey], status: active ? 'active' : 'inactive', updatedBy: identity.uid, updatedAt: now });
      for (const old of previous.docs) tx.set(old.ref, { status: 'inactive' }, { merge: true });
      if (active) for (const projectId of new Set(projectIds as string[])) tx.set(firestore.collection('projectMemberships').doc(`prjm_${projectId}_${user.uid}`), { workspaceId, projectId, userId: user.uid, status: 'active' });
      tx.create(firestore.collection('businessAccessEvents').doc(), { workspaceId, actorId: identity.uid, userId: user.uid, roleKey, active, projectIds: active ? projectIds : [], createdAt: now });
    });
    return { saved: true };
  });
}
