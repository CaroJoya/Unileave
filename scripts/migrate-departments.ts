// scripts/migrate-departments.ts
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import * as fs from 'fs';
import * as path from 'path';

// ✅ Manually load .env.local without dotenv
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          // Handle quoted values
          const cleanValue = value.replace(/^["']|["']$/g, '');
          process.env[key] = cleanValue;
        }
      }
    }
    console.log('✅ Loaded .env.local file');
  } else {
    console.log('⚠️ .env.local not found, using existing environment variables');
  }
}

// Load .env.local
loadEnvFile();

// Types
interface Department {
  id?: string;
  name?: string;
  hodId?: string | null;
  hodName?: string | null;
  registrarId?: string | null;
  registrarName?: string | null;
  isActive?: boolean;
  collegeId?: string;
  collegeName?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  uid?: string;
  name?: string;
  email?: string;
  roles?: string[];
  status?: string;
  departmentId?: string;
  departmentName?: string;
  collegeId?: string;
  collegeName?: string;
  isEmployed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

interface College {
  id?: string;
  name?: string;
  principalId?: string | null;
  principalName?: string | null;
  address?: string;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  databaseURL: string;
}

async function migrateDepartments() {
  console.log('🚀 Starting department migration...');

  // Load service account
  let serviceAccount: ServiceAccount;
  try {
    const keyPath = path.join(process.cwd(), 'service-account-key.json');
    if (fs.existsSync(keyPath)) {
      const fileContent = fs.readFileSync(keyPath, 'utf8');
      const parsed = JSON.parse(fileContent);
      serviceAccount = {
        projectId: parsed.project_id || parsed.projectId,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: parsed.private_key || parsed.privateKey,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '',
      };
      console.log('✅ Loaded service account from file');
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      // ✅ CRITICAL FIX: Properly handle private key with line breaks
      let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      
      // Remove surrounding quotes if present
      privateKey = privateKey.replace(/^["']|["']$/g, '');
      
      // Replace literal \n with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
      
      const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

      console.log('🔍 Looking for environment variables:');
      console.log(`  FIREBASE_PROJECT_ID: ${projectId ? '✅ Found' : '❌ Missing'}`);
      console.log(`  FIREBASE_CLIENT_EMAIL: ${clientEmail ? '✅ Found' : '❌ Missing'}`);
      console.log(`  FIREBASE_PRIVATE_KEY: ${privateKey ? '✅ Found (${privateKey.length} chars)' : '❌ Missing'}`);
      console.log(`  NEXT_PUBLIC_FIREBASE_DATABASE_URL: ${databaseURL ? '✅ Found' : '❌ Missing'}`);

      if (!projectId || !clientEmail || !privateKey || !databaseURL) {
        throw new Error('Missing Firebase environment variables');
      }

      // Validate private key format
      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        console.warn('⚠️ Private key does not contain "BEGIN PRIVATE KEY" - check format');
      }

      serviceAccount = {
        projectId,
        clientEmail,
        privateKey,
        databaseURL,
      };
      console.log('✅ Loaded service account from environment variables');
    }
  } catch (error) {
    console.error('❌ Failed to load service account:', error);
    console.log('\n💡 Try creating a service-account-key.json file in the project root');
    console.log('   or make sure .env.local has all Firebase environment variables.');
    process.exit(1);
  }

  // Initialize Firebase Admin
  let app: App;
  try {
    app = initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
      databaseURL: serviceAccount.databaseURL,
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    console.log('\n💡 The private key may be incorrectly formatted.');
    console.log('   Make sure FIREBASE_PRIVATE_KEY in .env.local contains the entire key');
    console.log('   with \\n for line breaks, not actual newlines.');
    process.exit(1);
  }

  const rtdb: Database = getDatabase(app);

  try {
    // Get all departments
    const deptsSnapshot = await rtdb.ref('departments').once('value');
    const departments: Record<string, Department> = deptsSnapshot.val() || {};

    console.log(`📊 Found ${Object.keys(departments).length} departments`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const [deptId, deptData] of Object.entries(departments)) {
      const dept: Department = deptData;
      const needsMigration = dept.registrarId === undefined;

      if (!needsMigration) {
        skippedCount++;
        continue;
      }

      // Add registrar fields
      const updateData: Partial<Department> = {
        updatedAt: new Date().toISOString(),
      };

      // For Office department, migrate hodId to registrarId if it's a Registrar
      const isOffice = dept.name?.toLowerCase() === 'office';
      if (isOffice && dept.hodId) {
        // Check if the user is actually a Registrar
        const userSnapshot = await rtdb.ref(`users/${dept.hodId}`).once('value');
        const user: User | null = userSnapshot.val();

        if (user && user.roles?.includes('registrar')) {
          // Move to registrar fields
          updateData.registrarId = dept.hodId;
          updateData.registrarName = dept.hodName;
          // Clear hod fields for Office department
          updateData.hodId = null;
          updateData.hodName = null;
          console.log(`  ✅ Migrated Registrar "${dept.hodName}" in "${dept.name}"`);
        } else {
          // Not a Registrar, keep as HOD
          updateData.registrarId = null;
          updateData.registrarName = null;
          console.log(`  ℹ️ "${dept.hodName}" in "${dept.name}" is not a Registrar, keeping as HOD`);
        }
      } else {
        // Non-Office departments: just add null registrar fields
        updateData.registrarId = null;
        updateData.registrarName = null;
      }

      await rtdb.ref(`departments/${deptId}`).update(updateData);
      migratedCount++;
    }

    // Also check and clean up college principal assignments
    console.log('\n📊 Checking college principals...');
    const collegesSnapshot = await rtdb.ref('colleges').once('value');
    const colleges: Record<string, College> = collegesSnapshot.val() || {};

    let principalMigratedCount = 0;

    for (const [collegeId, collegeData] of Object.entries(colleges)) {
      const college: College = collegeData;
      
      if (college.principalId) {
        // Check if the principal user exists and is active
        const userSnapshot = await rtdb.ref(`users/${college.principalId}`).once('value');
        const user: User | null = userSnapshot.val();
        
        if (!user || user.status === 'deleted') {
          console.log(`  ⚠️ College "${college.name}" has invalid Principal: ${college.principalId}`);
          await rtdb.ref(`colleges/${collegeId}`).update({
            principalId: null,
            principalName: null,
            updatedAt: new Date().toISOString(),
          });
          principalMigratedCount++;
        }
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Departments migrated: ${migratedCount}`);
    console.log(`   Departments skipped: ${skippedCount} (already have registrar fields)`);
    console.log(`   Invalid principals cleared: ${principalMigratedCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateDepartments();