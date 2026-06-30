// app/api/leave/balances/route.ts - COMPLETE FIXED FILE (No Cache)
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import type { LeaveBalancesDoc, LeaveBalance } from "@/types/leave";

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
  const rtdb = getRTDB();
  if (!rtdb) return DEFAULT_QUOTAS.faculty;

  try {
    const policySnapshot = await rtdb.ref(`leavePolicies/${academicYear}`).once("value");
    const policy = policySnapshot.val();
    
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
  } catch (error) {
    console.error("Error fetching policy:", error);
  }
  
  const roleKey = role === "lab_assistant" ? "lab_assistant" : 
                  role === "office_staff" ? "office_staff" : role;
  return DEFAULT_QUOTAS[roleKey] || DEFAULT_QUOTAS.faculty;
}

async function initializeBalance(
  userId: string, 
  userRole: string, 
  academicYear: string
): Promise<LeaveBalancesDoc> {
  const rtdb = getRTDB();
  if (!rtdb) throw new Error("Database not initialized");

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
  
  await rtdb.ref(`leaveBalances/${userId}_${academicYear}`).set(balanceDoc);
  return balanceDoc;
}

export async function GET() {
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
    const userId = decodedToken.uid;

    const [userSnapshot, balanceSnapshot] = await Promise.all([
      rtdb.ref(`users/${userId}`).once("value"),
      rtdb.ref(`leaveBalances/${userId}_${getCurrentAcademicYear()}`).once("value"),
    ]);

    const userData = userSnapshot.val();
    let balanceDoc = balanceSnapshot.val();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!balanceDoc) {
      const academicYear = getCurrentAcademicYear();
      const userRole = userData.roles?.[0] || "faculty";
      balanceDoc = await initializeBalance(userId, userRole, academicYear);
    }

    const response = NextResponse.json({
      success: true,
      balances: balanceDoc.balances,
      academicYear: balanceDoc.academicYear,
    });

    // ✅ FIX: Remove caching to always show fresh data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error("Error fetching leave balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave balances" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
    const userId = decodedToken.uid;

    const body = await request.json();
    const { leaveType, daysUsed, operation } = body;

    if (!leaveType || !daysUsed || !operation) {
      return NextResponse.json(
        { error: "Missing required fields: leaveType, daysUsed, operation" },
        { status: 400 }
      );
    }

    if (!["deduct", "restore"].includes(operation)) {
      return NextResponse.json(
        { error: "Operation must be 'deduct' or 'restore'" },
        { status: 400 }
      );
    }

    const academicYear = getCurrentAcademicYear();
    const balanceKey = `${userId}_${academicYear}`;
    const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
    const balanceSnapshot = await balanceRef.once("value");
    const balanceDoc = balanceSnapshot.val() as LeaveBalancesDoc | null;

    if (!balanceDoc) {
      return NextResponse.json({ error: "Leave balance not found" }, { status: 404 });
    }

    const currentBalance = balanceDoc.balances[leaveType];
    if (!currentBalance) {
      return NextResponse.json(
        { error: `Leave type ${leaveType} not found in balance` },
        { status: 404 }
      );
    }

    let updatedBalance: LeaveBalance;

    if (operation === "deduct") {
      if (currentBalance.available < daysUsed) {
        return NextResponse.json(
          { error: `Insufficient balance. Available: ${currentBalance.available}, Requested: ${daysUsed}` },
          { status: 400 }
        );
      }
      
      updatedBalance = {
        ...currentBalance,
        pending: (currentBalance.pending || 0) + daysUsed,
        available: currentBalance.available - daysUsed,
      };
    } else {
      updatedBalance = {
        ...currentBalance,
        pending: Math.max(0, (currentBalance.pending || 0) - daysUsed),
        available: currentBalance.available + daysUsed,
      };
    }

    const updateData = {
      [`balances.${leaveType}`]: updatedBalance,
      updatedAt: new Date().toISOString(),
    };

    await balanceRef.update(updateData);

    return NextResponse.json({
      success: true,
      balances: {
        ...balanceDoc.balances,
        [leaveType]: updatedBalance,
      },
    });
  } catch (error) {
    console.error("Error updating leave balances:", error);
    return NextResponse.json(
      { error: "Failed to update leave balances" },
      { status: 500 }
    );
  }
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
    
    const adminRoles = ["hod", "registrar", "principal", "head_clerk", "super_admin"];
    const isAdmin = userData?.roles?.some((role: string) => adminRoles.includes(role));

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Not authorized. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json() as { userIds: string[]; academicYear?: string };
    const { userIds, academicYear } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: "User IDs array is required" },
        { status: 400 }
      );
    }

    const year = academicYear || getCurrentAcademicYear();
    
    const balancePromises = userIds.map((uid: string) =>
      rtdb.ref(`leaveBalances/${uid}_${year}`).once("value")
    );

    const balanceSnapshots = await Promise.all(balancePromises);
    
    const balances: Record<string, LeaveBalancesDoc | null> = {};
    userIds.forEach((uid: string, index: number) => {
      const snapshot = balanceSnapshots[index];
      balances[uid] = snapshot.val() || null;
    });

    return NextResponse.json({
      success: true,
      balances,
      academicYear: year,
    });
  } catch (error) {
    console.error("Error fetching bulk balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}