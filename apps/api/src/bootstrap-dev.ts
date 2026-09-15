import { getFirebaseAdminServices } from './firebase-admin.js';

const uid = process.env.SURVEY_GURU_BOOTSTRAP_UID;
const email = process.env.SURVEY_GURU_BOOTSTRAP_EMAIL;

if (!uid || !email) {
  throw new Error('SURVEY_GURU_BOOTSTRAP_UID and SURVEY_GURU_BOOTSTRAP_EMAIL are required.');
}

if ((process.env.SURVEY_GURU_ENV ?? 'local') !== 'dev') {
  throw new Error('DEV bootstrap refused: SURVEY_GURU_ENV must be dev.');
}

const workspaceId = 'ws_tes_survey_guru_dev';
const membershipId = `wsm_${uid}`;
const roleKey = 'tes_super_admin';
const projectId = 'prj_soweto_retail_universe';
const projectMembershipId = `prjm_${projectId}_${uid}`;
const { firestore } = getFirebaseAdminServices();
const batch = firestore.batch();

batch.set(firestore.collection('users').doc(uid), {
  firebaseUid: uid,
  email,
  status: 'active',
  environment: 'dev',
  updatedAt: new Date().toISOString(),
}, { merge: true });

batch.set(firestore.collection('organisations').doc('org_tes'), {
  name: 'TES — Task Expert Systems',
  status: 'active',
  environment: 'dev',
}, { merge: true });

batch.set(firestore.collection('workspaces').doc(workspaceId), {
  organisationId: 'org_tes',
  name: 'Survey Guru DEV',
  status: 'active',
  environment: 'dev',
}, { merge: true });

batch.set(firestore.collection('roleDefinitions').doc(roleKey), {
  name: 'TES Super Administrator',
  scope: 'platform-and-workspace',
  permissions: [
    'platform.admin',
    'workspace.admin',
    'project.read',
    'assignment.read',
    'field.capture',
    'qa.review',
    'coverage.read',
    'opportunity.read',
    'report.read',
    'export.data',
  ],
  environment: 'dev',
}, { merge: true });

batch.set(firestore.collection('workspaceMemberships').doc(membershipId), {
  userId: uid,
  workspaceId,
  roleKey,
  status: 'active',
  environment: 'dev',
}, { merge: true });

batch.set(firestore.collection('projects').doc(projectId), {
  workspaceId,
  name: 'Soweto Retail Universe',
  status: 'active',
  environment: 'dev',
  summary: {
    searchedPercent: 72,
    outstandingKm: 18.6,
    verifiedPriorityOutlets: 74,
    networkDecision: 'not-yet',
  },
}, { merge: true });

batch.set(firestore.collection('projectMemberships').doc(projectMembershipId), {
  userId: uid,
  workspaceId,
  projectId,
  status: 'active',
  environment: 'dev',
}, { merge: true });

await batch.commit();

console.log(JSON.stringify({
  status: 'ok',
  environment: 'dev',
  workspaceId,
  membershipId,
  roleKey,
  projectId,
  projectMembershipId,
}, null, 2));
