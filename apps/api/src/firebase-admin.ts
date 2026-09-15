import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type FirebaseAdminServices = {
  app: App;
  auth: Auth;
  firestore: Firestore;
};

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function readFirebaseAdminConfig(): FirebaseAdminConfig | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };
}

export function isFirebaseAdminConfigured(): boolean {
  return readFirebaseAdminConfig() !== null;
}

export function getFirebaseAdminServices(): FirebaseAdminServices {
  const config = readFirebaseAdminConfig();
  if (!config) {
    throw new Error('Firebase Admin is not configured for this environment.');
  }

  const existing = getApps()[0];
  const app = existing ?? initializeApp({
    credential: cert(config),
  });

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}
