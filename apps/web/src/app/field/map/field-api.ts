'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseClientAuth } from '../../../lib/firebase-client';

function waitForFirebaseUser(): Promise<User | null> {
  const auth = getFirebaseClientAuth();
  if (!auth) return Promise.resolve(null);
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getFieldToken(): Promise<string> {
  const user = await waitForFirebaseUser();
  if (!user) throw new Error('Sign in required for field capture.');
  return user.getIdToken();
}

export async function getFieldUserId(): Promise<string> {
  const user = await waitForFirebaseUser();
  if (!user) throw new Error('Sign in to synchronise saved locations.');
  return user.uid;
}

export async function getFieldUserLabel(): Promise<string> {
  const user = await waitForFirebaseUser();
  if (!user) return 'Signed-in user';
  return user.displayName?.trim() || user.email?.split('@')[0] || 'Signed-in user';
}

export function fieldApiOrigin(): string {
  return process.env.NEXT_PUBLIC_SURVEY_GURU_API_URL ?? 'http://127.0.0.1:8080';
}
