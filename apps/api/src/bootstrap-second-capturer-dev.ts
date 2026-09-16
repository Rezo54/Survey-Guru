import { getFirebaseAdminServices } from './firebase-admin.js';

const uid = process.env.SURVEY_GURU_SECOND_CAPTURER_UID;
const email = process.env.SURVEY_GURU_SECOND_CAPTURER_EMAIL;
if (!uid || !email) throw new Error('SURVEY_GURU_SECOND_CAPTURER_UID and SURVEY_GURU_SECOND_CAPTURER_EMAIL are required.');
if ((process.env.SURVEY_GURU_ENV ?? 'local') !== 'dev') throw new Error('Second-capturer bootstrap refused: SURVEY_GURU_ENV must be dev.');
if (uid === process.env.SURVEY_GURU_BOOTSTRAP_UID) throw new Error('Second capturer must use a different Firebase identity.');

const workspaceId = 'ws_tes_survey_guru_dev';
const projectId = 'prj_soweto_retail_universe';
const coveragePolicyId = 'cp_soweto_retail_universe_v1';
const roleKey = 'field_worker';
const membershipId = `wsm_${uid}`;
const projectMembershipId = `prjm_${projectId}_${uid}`;
const assignmentId = 'asg_dobsonville_west_team05';
const { firestore } = getFirebaseAdminServices();
const batch = firestore.batch();

batch.set(firestore.collection('users').doc(uid), {
  firebaseUid: uid,
  email,
  status: 'active',
  environment: 'dev',
  updatedAt: new Date().toISOString(),
}, { merge: true });

batch.set(firestore.collection('roleDefinitions').doc(roleKey), {
  name: 'Field Worker',
  scope: 'workspace-project-assignment',
  permissions: ['project.read', 'assignment.read', 'field.capture', 'coverage.read'],
  environment: 'dev',
}, { merge: true });

batch.set(firestore.collection('workspaceMemberships').doc(membershipId), {
  userId: uid,
  workspaceId,
  roleKey,
  status: 'active',
  environment: 'dev',
}, { merge: true });

batch.set(firestore.collection('projectMemberships').doc(projectMembershipId), {
  userId: uid,
  workspaceId,
  projectId,
  status: 'active',
  environment: 'dev',
}, { merge: true });

batch.set(firestore.collection('assignments').doc(assignmentId), {
  workspaceId,
  projectId,
  assignedUserId: uid,
  teamId: 'team_05',
  teamName: 'Team 05',
  areaName: 'Dobsonville West',
  assignmentType: 'coverage_search',
  status: 'active',
  priority: 'priority',
  evidenceState: 'shared_project_coverage',
  targetState: 'searched',
  scheduledWindow: 'Second-capturer DEV test',
  outstandingKm: 18.6,
  coveragePolicyId,
  environment: 'dev',
}, { merge: true });

await batch.commit();
console.log(JSON.stringify({
  status: 'ok',
  environment: 'dev',
  purpose: 'shared-project-coverage-second-capturer',
  uid,
  email,
  workspaceId,
  membershipId,
  projectId,
  projectMembershipId,
  assignmentId,
  searchSessionId: `ss_${assignmentId}`,
}, null, 2));
