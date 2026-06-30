// app/api/admin/seed-leave-types/route.ts - COMPLETE UPDATED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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
    faculty: { CL: number; EL: number; ML: number; CO: number; OD: number; MAT: number; PAT: number; SPL: number };
    lab_assistant: { CL: number; EL: number; ML: number; CO: number; OD: number; MAT: number; PAT: number; SPL: number };
    office_staff: { CL: number; EL: number; ML: number; CO: number; OD: number; MAT: number; PAT: number; SPL: number };
    hod: { CL: number; EL: number; ML: number; CO: number; OD: number; MAT: number; PAT: number; SPL: number };
    registrar: { CL: number; EL: number; ML: number; CO: number; OD: number; MAT: number; PAT: number; SPL: number };
    principal: { CL: number; EL: number; ML: number; CO: number; OD: number; MAT: number; PAT: number; SPL: number };
    head_clerk: { CL: number; EL: number; ML: number; CO: number; OD: number; MAT: number; PAT: number; SPL: number };
  };
  effectiveFrom: string;
  applyRule: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

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
    description: "Official duty such as conferences, workshops, FDPs, external exams",
    allowHalfDay: true,
    requiresAttachment: true,
    deductsBalance: false, // ✅ OD does NOT deduct balance
    hasExpiry: false,
    expiryInDays: null,
    requiresEventDetails: true, // ✅ OD requires event details
    maxConsecutiveDays: 10,
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
      faculty: { CL: 24, EL: 12, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
      lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
      office_staff: { CL: 20, EL: 10, ML: 15, CO: 8, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
      hod: { CL: 24, EL: 15, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
      registrar: { CL: 20, EL: 12, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
      principal: { CL: 30, EL: 20, ML: 15, CO: 12, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
      head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
    },
    effectiveFrom: new Date().toISOString(),
    applyRule: "immediate",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val();

    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized - Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    const existingSnapshot = await rtdb.ref("leaveTypes").once("value");
    const existingTypes = existingSnapshot.val();

    if (existingTypes && Object.keys(existingTypes).length > 0) {
      if (!force) {
        return NextResponse.json({
          success: false,
          message: `Leave types already exist (${Object.keys(existingTypes).length} types found). Use force=true to override.`,
          existing: Object.keys(existingTypes),
        }, { status: 409 });
      }
      
      console.log("Force mode enabled - deleting existing leave types...");
      await rtdb.ref("leaveTypes").remove();
      await rtdb.ref("leavePolicies").remove();
      console.log("Existing leave types and policies removed.");
    }

    const seeded: string[] = [];

    for (const typeData of DEFAULT_LEAVE_TYPES) {
      const id = `leave_${typeData.leaveCode.toLowerCase()}`;
      const leaveType: LeaveType = {
        id,
        ...typeData,
      };

      await rtdb.ref(`leaveTypes/${id}`).set(leaveType);
      seeded.push(`${typeData.leaveCode}: ${typeData.leaveName}`);
    }

    const policy = getDefaultPolicy();
    await rtdb.ref(`leavePolicies/${policy.id}`).set(policy);

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: decodedToken.uid,
      userName: userData.name || "Super Admin",
      userRole: "super_admin",
      action: "LEAVE_TYPES_SEEDED",
      module: "leaveTypes",
      details: JSON.stringify({
        typesSeeded: seeded.length,
        policyCreated: policy.academicYear,
        forceMode: force,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${seeded.length} leave types${force ? ' (force mode)' : ''}`,
      seeded,
      policy: policy.academicYear,
    });
  } catch (error) {
    console.error("Error seeding leave types:", error);
    return NextResponse.json(
      { error: "Failed to seed leave types" },
      { status: 500 }
    );
  }
}