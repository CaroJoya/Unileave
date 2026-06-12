import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import { getAuth, Auth } from 'firebase-admin/auth';

// Check for missing env vars without throwing immediately
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

let app: App | null = null;
let rtdb: Database | null = null;
let auth: Auth | null = null;

// Only initialize if we have the required env vars
if (projectId && clientEmail && privateKey && databaseURL && !getApps().length) {
  app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL,
  });
  rtdb = getDatabase(app);
  auth = getAuth(app);
} else if (getApps().length) {
  app = getApps()[0];
  rtdb = getDatabase(app);
  auth = getAuth(app);
} else {
  console.warn('⚠️ Missing Firebase Admin environment variables');
  console.warn('Some API routes may not work until .env.local is configured');
}

export { rtdb, auth };