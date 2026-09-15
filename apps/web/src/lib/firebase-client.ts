import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;

export function isFirebaseClientConfigured(): boolean {
  return requiredKeys.every((key) => Boolean(firebaseConfig[key]));
}

function getValidatedFirebaseConfig(): FirebaseOptions | null {
  if (!isFirebaseClientConfigured()) return null;

  return {
    apiKey: firebaseConfig.apiKey!,
    authDomain: firebaseConfig.authDomain!,
    projectId: firebaseConfig.projectId!,
    appId: firebaseConfig.appId!,
    ...(firebaseConfig.storageBucket ? { storageBucket: firebaseConfig.storageBucket } : {}),
    ...(firebaseConfig.messagingSenderId ? { messagingSenderId: firebaseConfig.messagingSenderId } : {})
  };
}

export function getFirebaseClientApp(): FirebaseApp | null {
  const config = getValidatedFirebaseConfig();
  if (!config) return null;
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function getFirebaseClientAuth(): Auth | null {
  const app = getFirebaseClientApp();
  return app ? getAuth(app) : null;
}

export function createGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
