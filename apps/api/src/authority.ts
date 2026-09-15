import type { AuthenticatedIdentity } from './auth.js';
import { getFirebaseAdminServices } from './firebase-admin.js';

export type SurveyGuruPermission =
  | 'platform.admin'
  | 'workspace.admin'
  | 'project.read'
  | 'assignment.read'
  | 'field.capture'
  | 'qa.review'
  | 'coverage.read'
  | 'opportunity.read'
  | 'report.read'
  | 'export.data';

export type AuthorityContext = {
  identity: AuthenticatedIdentity;
  workspaceId: string;
  membershipId: string;
  roleKey: string;
  permissions: ReadonlySet<SurveyGuruPermission>;
  projectIds: ReadonlySet<string>;
  assignmentIds: ReadonlySet<string>;
};

export class AuthorisationError extends Error {
  statusCode = 403;
}

export function requirePermission(
  authority: AuthorityContext,
  permission: SurveyGuruPermission,
): void {
  if (!authority.permissions.has(permission)) {
    throw new AuthorisationError(`Permission required: ${permission}`);
  }
}

export function requireProjectScope(authority: AuthorityContext, projectId: string): void {
  if (!authority.projectIds.has(projectId)) {
    throw new AuthorisationError('Project is outside the authorised scope.');
  }
}

export function requireAssignmentScope(authority: AuthorityContext, assignmentId: string): void {
  if (!authority.assignmentIds.has(assignmentId)) {
    throw new AuthorisationError('Assignment is outside the authorised scope.');
  }
}

export async function resolveAuthority(identity: AuthenticatedIdentity): Promise<AuthorityContext> {
  const { firestore } = getFirebaseAdminServices();
  const user = await firestore.collection('users').doc(identity.uid).get();

  if (!user.exists || user.get('status') !== 'active') {
    throw new AuthorisationError('No active Survey Guru user is resolved.');
  }

  const memberships = await firestore
    .collection('workspaceMemberships')
    .where('userId', '==', identity.uid)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  const membership = memberships.docs[0];
  if (!membership) {
    throw new AuthorisationError('No active Survey Guru workspace membership is resolved.');
  }

  const workspaceId = membership.get('workspaceId');
  const roleKey = membership.get('roleKey');
  if (typeof workspaceId !== 'string' || typeof roleKey !== 'string') {
    throw new AuthorisationError('Workspace membership is invalid.');
  }

  const role = await firestore.collection('roleDefinitions').doc(roleKey).get();
  const permissionValues: unknown = role.get('permissions');
  if (!role.exists || !Array.isArray(permissionValues)) {
    throw new AuthorisationError('Workspace role is not resolved.');
  }

  const permissions = permissionValues.filter(
    (permission): permission is SurveyGuruPermission => typeof permission === 'string',
  );

  return {
    identity,
    workspaceId,
    membershipId: membership.id,
    roleKey,
    permissions: new Set(permissions),
    projectIds: new Set<string>(),
    assignmentIds: new Set<string>(),
  };
}
