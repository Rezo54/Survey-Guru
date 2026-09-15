import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type FirebaseAdminServices = {
  app: App;
  auth: Auth;
  firestore: Firestore;
};

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getFirebaseAdminServices(): FirebaseAdminServices {
  if (!isFirebaseAdminConfigured()) {
    throw new Error('Firebase Admin is not configured for this environment.');
  }

  const existing = getApps()[0];
  const app = existing ?? initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}
