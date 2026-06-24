// lib/firebase/admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
// ✅ Rename the import to avoid conflict with local variable
import { getAuth as getFirebaseAuth, Auth } from 'firebase-admin/auth';

// Check for missing env vars without throwing immediately
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

let app: App | null = null;
let rtdb: Database | null = null;
let auth: Auth | null = null;

// ✅ LAZY INITIALIZATION - Only initialize when needed
function initializeFirebaseAdmin() {
  // If already initialized, return early
  if (app) return { rtdb, auth };
  
  // Check if we have the required env vars
  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    console.warn('⚠️ Missing Firebase Admin environment variables');
    return { rtdb: null, auth: null };
  }

  try {
    // Check if already initialized by another module
    if (getApps().length) {
      app = getApps()[0];
    } else {
      // Initialize new app
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL,
      });
    }
    
    // ✅ Use the renamed import
    rtdb = getDatabase();
    auth = getFirebaseAuth();
    
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    app = null;
    rtdb = null;
    auth = null;
  }
  
  return { rtdb, auth };
}

// ✅ Export getters that lazily initialize
export function getRTDB(): Database | null {
  initializeFirebaseAdmin();
  return rtdb;
}

export function getAuth(): Auth | null {
  initializeFirebaseAdmin();
  return auth;
}

// ✅ Keep existing exports for backward compatibility
export { rtdb, auth };