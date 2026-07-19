import admin from 'firebase-admin';
import { env } from '../config/env';
import { FirebaseTokenResult } from './auth.types';

let firebaseApp: admin.app.App | null = null;

export function initializeFirebaseAdmin(): void {
  if (env.AUTH_MODE !== 'firebase') {
    return;
  }

  if (firebaseApp) {
    return;
  }

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase credentials required when AUTH_MODE=firebase');
  }

  // Handle escaped newlines in private key
  const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

export async function verifyFirebaseToken(token: string): Promise<FirebaseTokenResult> {
  if (env.AUTH_MODE === 'mock') {
    // In mock mode, return a mock result
    return {
      firebaseUid: 'mock-uid',
      email: 'mock@example.com',
      emailVerified: true,
    };
  }

  if (!firebaseApp) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    return {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
    };
  } catch (error) {
    throw new Error('Invalid Firebase token');
  }
}

export function isFirebaseInitialized(): boolean {
  return firebaseApp !== null;
}
