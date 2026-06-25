// lib/firebase/admin.ts - COMPLETE FIXED FILE
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import { getAuth as getFirebaseAuth, Auth } from 'firebase-admin/auth';

// Check for missing env vars
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

let app: App | null = null;
let rtdbInstance: Database | null = null;
let authInstance: Auth | null = null;

function initializeFirebaseAdmin() {
  if (app) return { rtdb: rtdbInstance, auth: authInstance };
  
  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    console.warn('⚠️ Missing Firebase Admin environment variables');
    return { rtdb: null, auth: null };
  }

  try {
    if (getApps().length) {
      app = getApps()[0];
    } else {
      app = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        databaseURL,
      });
    }
    
    rtdbInstance = getDatabase();
    authInstance = getFirebaseAuth();
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    app = null;
    rtdbInstance = null;
    authInstance = null;
  }
  
  return { rtdb: rtdbInstance, auth: authInstance };
}

// ✅ ONLY export lazy getters
export function getRTDB(): Database | null {
  initializeFirebaseAdmin();
  return rtdbInstance;
}

export function getAuth(): Auth | null {
  initializeFirebaseAdmin();
  return authInstance;
}

// ❌ REMOVED - No more direct exports
// export { rtdb, auth };