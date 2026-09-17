import { getFirebaseAdminServices } from './firebase-admin.js';

const uid = process.env.SURVEY_GURU_BOOTSTRAP_UID;
const email = process.env.SURVEY_GURU_BOOTSTRAP_EMAIL;
if (!uid || !email) throw new Error('SURVEY_GURU_BOOTSTRAP_UID and SURVEY_GURU_BOOTSTRAP_EMAIL are required.');
if ((process.env.SURVEY_GURU_ENV ?? 'local') !== 'dev') throw new Error('DEV bootstrap refused: SURVEY_GURU_ENV must be dev.');

const workspaceId = 'ws_tes_survey_guru_dev';
const membershipId = `wsm_${uid}`;
const roleKey = 'tes_super_admin';
const projectId = 'prj_soweto_retail_universe';
const projectMembershipId = `prjm_${projectId}_${uid}`;
const assignmentId = 'asg_dobsonville_west_team04';
const searchSessionId = `ss_${assignmentId}`;
const coveragePolicyId = 'cp_soweto_retail_universe_v1';
const { firestore } = getFirebaseAdminServices();
const batch = firestore.batch();

batch.set(firestore.collection('users').doc(uid), { firebaseUid: uid, email, status: 'active', environment: 'dev', updatedAt: new Date().toISOString() }, { merge: true });
batch.set(firestore.collection('organisations').doc('org_tes'), { name: 'TES — Task Expert Systems', status: 'active', environment: 'dev' }, { merge: true });
batch.set(firestore.collection('workspaces').doc(workspaceId), { organisationId: 'org_tes', name: 'Survey Guru DEV', status: 'active', environment: 'dev' }, { merge: true });
batch.set(firestore.collection('roleDefinitions').doc(roleKey), { name: 'TES Super Administrator', scope: 'platform-and-workspace', permissions: ['platform.admin','workspace.admin','project.read','assignment.read','field.capture','qa.review','coverage.read','opportunity.read','report.read','export.data'], environment: 'dev' }, { merge: true });
batch.set(firestore.collection('workspaceMemberships').doc(membershipId), { userId: uid, workspaceId, roleKey, status: 'active', environment: 'dev' }, { merge: true });
batch.set(firestore.collection('coveragePolicies').doc(coveragePolicyId), { workspaceId, projectId, mode: 'EXHAUSTIVE_STREET', version: 1, status: 'pilot', movementModesAllowed: ['walking'], minimumGpsAccuracyRule: { maximumMetres: 100 }, continuityRule: { maximumGapSeconds: 600 }, mapMatching: { maximumLateralDistanceMetres: 25, maximumHeadingDeltaDegrees: 40, minimumContinuityScore: 0.65, ambiguityScoreGap: 0.12 }, thresholds: { partialTraversalPercent: 25, coveredTraversalPercent: 85 }, verificationRequired: true, algorithmVersion: 'map-match-dev-v1', environment: 'dev' }, { merge: true });
batch.set(firestore.collection('projects').doc(projectId), {
  workspaceId,
  name: 'Soweto Retail Universe',
  status: 'active',
  environment: 'dev',
  coveragePolicyId,
  storeCaptureRequiredQuestionIds: ['ownerName', 'stockedBrands', 'pricing'],
  storeQaPolicy: {
    mode: 'EXCEPTION_ONLY',
    autoVerifyEnabled: true,
    manualApprovalBeforeExport: false,
    maximumGpsAccuracyMetres: 30,
    minimumPhotoCount: 1,
    policyVersion: 'store-qa-dev-v1',
  },
  boundary: [
    { latitude: -26.201, longitude: 27.824 },
    { latitude: -26.193, longitude: 27.876 },
    { latitude: -26.214, longitude: 27.913 },
    { latitude: -26.253, longitude: 27.916 },
    { latitude: -26.281, longitude: 27.892 },
    { latitude: -26.289, longitude: 27.843 },
    { latitude: -26.264, longitude: 27.806 },
    { latitude: -26.226, longitude: 27.803 },
  ],
  boundaryVersion: 'dev-soweto-2026-09-16',
  summary: { searchedPercent: 72, outstandingKm: 18.6, verifiedPriorityOutlets: 74, networkDecision: 'not-yet' },
}, { merge: true });
batch.set(firestore.collection('projectMemberships').doc(projectMembershipId), { userId: uid, workspaceId, projectId, status: 'active', environment: 'dev' }, { merge: true });
batch.set(firestore.collection('assignments').doc(assignmentId), { workspaceId, projectId, assignedUserId: uid, teamId: 'team_04', teamName: 'Team 04', areaName: 'Dobsonville West', assignmentType: 'coverage_search', status: 'active', priority: 'priority', evidenceState: 'unknown', targetState: 'searched', scheduledWindow: '08:00–10:30', outstandingKm: 18.6, coveragePolicyId, environment: 'dev' }, { merge: true });
batch.set(firestore.collection('searchSessions').doc(searchSessionId), { workspaceId, projectId, assignmentId, userId: uid, teamId: 'team_04', areaName: 'Dobsonville West', state: 'READY', coverageState: 'UNCOVERED', searchedKm: 0, partialKm: 0, unknownKm: 18.6, queuedEvidenceCount: 0, acceptedEvidenceCount: 0, rejectedEvidenceCount: 0, coveragePolicyId, coveragePolicyVersion: 1, environment: 'dev', updatedAt: new Date().toISOString() }, { merge: true });

const projectStreetSegments = [
  { id: 'pss_niemann_south', streetSegmentId: 'sg_niemann_south', lengthMetres: 310, geometry: [{ latitude: -26.2515, longitude: 27.8148 }, { latitude: -26.2442, longitude: 27.8351 }] },
  { id: 'pss_nitrogen_central', streetSegmentId: 'sg_nitrogen_central', lengthMetres: 280, geometry: [{ latitude: -26.2460, longitude: 27.8350 }, { latitude: -26.2382, longitude: 27.8558 }] },
  { id: 'pss_harlem_east', streetSegmentId: 'sg_harlem_east', lengthMetres: 245, geometry: [{ latitude: -26.2581, longitude: 27.8680 }, { latitude: -26.2630, longitude: 27.8920 }] },
] as const;
for (const segment of projectStreetSegments) {
  batch.set(firestore.collection('projectStreetSegments').doc(segment.id), { workspaceId, projectId, ...segment, eligible: true, source: { provider: 'dev-fixture', sourceId: segment.streetSegmentId, sourceVersion: '2026-09-16' }, verificationStatus: 'UNVERIFIED', environment: 'dev' }, { merge: true });
}

await batch.commit();
console.log(JSON.stringify({ status: 'ok', environment: 'dev', workspaceId, membershipId, roleKey, projectId, projectMembershipId, assignmentId, searchSessionId, coveragePolicyId }, null, 2));
