// app/api/leave/balances/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import type { LeaveBalancesDoc, LeaveBalance } from "@/types/leave";

// Default leave quotas per role
const DEFAULT_QUOTAS: Record<string, Record<string, number>> = {
  faculty: { CL: 24, EL: 12, ML: 15, CO: 10 },
  lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8 },
  office_staff: { CL: 20, EL: 10, ML: 15, CO: 8 },
  hod: { CL: 24, EL: 15, ML: 15, CO: 10 },
  registrar: { CL: 20, EL: 12, ML: 15, CO: 10 },
  principal: { CL: 30, EL: 20, ML: 15, CO: 12 },
  head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10 },
};

async function getRoleQuotas(role: string, academicYear: string): Promise<Record<string, number>> {
  // First check if there's a policy for this academic year
  const policySnapshot = await rtdb?.ref(`leavePolicies/${academicYear}`).once("value");
  const policy = policySnapshot?.val();
  
  if (policy && policy.leaveAllocations) {
    const roleKey = role === "lab_assistant" ? "lab_assistant" : 
                    role === "office_staff" ? "office_staff" : role;
    const allocation = policy.leaveAllocations[roleKey];
    if (allocation) {
      return {
        CL: allocation.CL || 0,
        EL: allocation.EL || 0,
        ML: allocation.ML || 0,
        CO: allocation.CO || 0,
      };
    }
  }
  
  // Fallback to default quotas
  const roleKey = role === "lab_assistant" ? "lab_assistant" : 
                  role === "office_staff" ? "office_staff" : role;
  return DEFAULT_QUOTAS[roleKey] || DEFAULT_QUOTAS.faculty;
}

async function initializeBalance(userId: string, userRole: string, academicYear: string): Promise<LeaveBalancesDoc> {
  const quotas = await getRoleQuotas(userRole, academicYear);
  
  const balances: Record<string, LeaveBalance> = {
    CL: { allocated: quotas.CL, used: 0, pending: 0, available: quotas.CL },
    EL: { allocated: quotas.EL, used: 0, pending: 0, available: quotas.EL },
    ML: { allocated: quotas.ML, used: 0, pending: 0, available: quotas.ML },
    CO: { allocated: quotas.CO, used: 0, pending: 0, available: quotas.CO },
  };
  
  const balanceDoc: LeaveBalancesDoc = {
    userId,
    academicYear,
    balances,
    updatedAt: new Date().toISOString(),
  };
  
  await rtdb?.ref(`leaveBalances/${userId}_${academicYear}`).set(balanceDoc);
  return balanceDoc;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // Get user data
    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = userSnapshot.val();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const academicYear = getCurrentAcademicYear();
    const balanceKey = `${userId}_${academicYear}`;
    const balanceSnapshot = await rtdb.ref(`leaveBalances/${balanceKey}`).once("value");
    let balanceDoc = balanceSnapshot.val();

    if (!balanceDoc) {
      const userRole = userData.roles?.[0] || "faculty";
      balanceDoc = await initializeBalance(userId, userRole, academicYear);
    }

    return NextResponse.json({
      success: true,
      balances: balanceDoc.balances,
      academicYear: balanceDoc.academicYear,
    });
  } catch (error) {
    console.error("Error fetching leave balances:", error);
    return NextResponse.json({ error: "Failed to fetch leave balances" }, { status: 500 });
  }
}