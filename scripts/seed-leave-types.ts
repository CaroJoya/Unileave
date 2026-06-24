// scripts/seed-leave-types.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface LeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  description: string;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  deductsBalance: boolean;
  hasExpiry: boolean;
  expiryInDays: number | null;
  requiresEventDetails: boolean;
  maxConsecutiveDays: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface LeavePolicy {
  id: string;
  academicYear: string;
  leaveAllocations: {
    faculty: { CL: number; EL: number; ML: number; CO: number };
    lab_assistant: { CL: number; EL: number; ML: number; CO: number };
    office_staff: { CL: number; EL: number; ML: number; CO: number };
    hod: { CL: number; EL: number; ML: number; CO: number };
    registrar: { CL: number; EL: number; ML: number; CO: number };
    principal: { CL: number; EL: number; ML: number; CO: number };
    head_clerk: { CL: number; EL: number; ML: number; CO: number };
  };
  effectiveFrom: string;
  applyRule: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Default leave types data
const DEFAULT_LEAVE_TYPES: Omit<LeaveType, 'id'>[] = [
  {
    leaveCode: "CL",
    leaveName: "Casual Leave",
    description: "For personal reasons, vacation, or short breaks",
    allowHalfDay: true,
    requiresAttachment: false,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: false,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    leaveCode: "EL",
    leaveName: "Earned Leave",
    description: "Earned leave based on service duration",
    allowHalfDay: true,
    requiresAttachment: false,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: false,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    leaveCode: "ML",
    leaveName: "Medical Leave",
    description: "For medical treatment or illness",
    allowHalfDay: true,
    requiresAttachment: true,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: false,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    leaveCode: "CO",
    leaveName: "Comp Off",
    description: "Compensatory off for extra work on holidays/weekends",
    allowHalfDay: false,
    requiresAttachment: true,
    deductsBalance: true,
    hasExpiry: true,
    expiryInDays: 180,
    requiresEventDetails: false,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    leaveCode: "OD",
    leaveName: "On Duty",
    description: "Official duty such as conferences, workshops, FDPs",
    allowHalfDay: true,
    requiresAttachment: true,
    deductsBalance: false,
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: true,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    leaveCode: "MAT",
    leaveName: "Maternity Leave",
    description: "Maternity leave for childbirth",
    allowHalfDay: false,
    requiresAttachment: true,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: false,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    leaveCode: "PAT",
    leaveName: "Paternity Leave",
    description: "Paternity leave for childbirth",
    allowHalfDay: false,
    requiresAttachment: true,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: false,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    leaveCode: "SPL",
    leaveName: "Special Leave",
    description: "Special leave for emergencies or exceptional cases",
    allowHalfDay: true,
    requiresAttachment: true,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: false,
    maxConsecutiveDays: null,
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (month >= 5) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

function getDefaultPolicy(): LeavePolicy {
  const academicYear = getCurrentAcademicYear();
  return {
    id: academicYear,
    academicYear: academicYear,
    leaveAllocations: {
      faculty: { CL: 24, EL: 12, ML: 15, CO: 10 },
      lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8 },
      office_staff: { CL: 20, EL: 10, ML: 15, CO: 8 },
      hod: { CL: 24, EL: 15, ML: 15, CO: 10 },
      registrar: { CL: 20, EL: 12, ML: 15, CO: 10 },
      principal: { CL: 30, EL: 20, ML: 15, CO: 12 },
      head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10 },
    },
    effectiveFrom: new Date().toISOString(),
    applyRule: "immediate",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function seedLeaveTypes() {
  console.log('🚀 Starting leave types seed...');

  // Load service account
  let serviceAccount;
  try {
    const keyPath = path.join(process.cwd(), 'service-account-key.json');
    if (fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      console.log('✅ Loaded service account from file');
    } else {
      // Try environment variables
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

      if (!projectId || !clientEmail || !privateKey || !databaseURL) {
        throw new Error('Missing Firebase environment variables. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and NEXT_PUBLIC_FIREBASE_DATABASE_URL');
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
    console.error('Please ensure service-account-key.json exists or environment variables are set.');
    process.exit(1);
  }

  // Initialize Firebase Admin
  let app;
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
    process.exit(1);
  }

  const rtdb = getDatabase(app);

  try {
    // Check if leave types already exist
    console.log('📊 Checking existing leave types...');
    const snapshot = await rtdb.ref('leaveTypes').once('value');
    const existingTypes = snapshot.val();

    if (existingTypes && Object.keys(existingTypes).length > 0) {
      console.log(`⚠️ Leave types already exist (${Object.keys(existingTypes).length} types found).`);
      console.log('Skipping seed. Use force=true to override.');
      console.log('Existing types:', Object.keys(existingTypes).join(', '));
      process.exit(0);
    }

    // Seed leave types
    console.log('📝 Seeding 8 leave types...');
    const results: string[] = [];

    for (const typeData of DEFAULT_LEAVE_TYPES) {
      const id = `leave_${typeData.leaveCode.toLowerCase()}`;
      const leaveType: LeaveType = {
        id,
        ...typeData,
      };

      await rtdb.ref(`leaveTypes/${id}`).set(leaveType);
      results.push(`${typeData.leaveCode}: ${typeData.leaveName} (Half Day: ${typeData.allowHalfDay ? '✅' : '❌'})`);
      console.log(`   ✅ Created ${typeData.leaveCode} (${typeData.leaveName})`);
    }

    console.log(`✅ Successfully seeded ${results.length} leave types`);

    // Seed default leave policy
    console.log('📝 Seeding default leave policy...');
    const policy = getDefaultPolicy();
    await rtdb.ref(`leavePolicies/${policy.id}`).set(policy);
    console.log(`✅ Created leave policy for ${policy.academicYear}`);

    console.log('\n📊 Seeding Summary:');
    console.log(`   Leave Types: ${results.length}`);
    console.log(`   Leave Policy: ${policy.academicYear}`);
    console.log('\n🎉 Seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run the seed
seedLeaveTypes();