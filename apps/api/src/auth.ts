import type { FastifyRequest } from 'fastify';
import { getFirebaseAdminServices } from './firebase-admin.js';

export type AuthenticatedIdentity = {
  uid: string;
  email?: string;
};

export class AuthenticationError extends Error {
  statusCode = 401;
}

export async function verifyRequestIdentity(request: FastifyRequest): Promise<AuthenticatedIdentity> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    throw new AuthenticationError('Bearer identity token required.');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new AuthenticationError('Bearer identity token required.');
  }

  try {
    const decoded = await getFirebaseAdminServices().auth.verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
    };
  } catch {
    throw new AuthenticationError('Identity token is invalid or revoked.');
  }
}
