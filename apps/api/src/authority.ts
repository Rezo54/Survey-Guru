import type { AuthenticatedIdentity } from './auth.js';

export type SurveyGuruPermission =
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

// Persistence-backed authority resolution is intentionally not implemented
// until the DEV Firebase project exists. Authentication alone must never
// manufacture workspace, permission, project or assignment authority.
export async function resolveAuthority(_identity: AuthenticatedIdentity): Promise<AuthorityContext> {
  throw new AuthorisationError('No active Survey Guru workspace membership is resolved.');
}
