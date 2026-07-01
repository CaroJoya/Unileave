// app/api/leave/balances/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { getOrCreateLeaveBalance } from "@/lib/services/leave-balance-service";
import type { LeaveBalancesDoc } from "@/types/leave";

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
    const academicYear = getCurrentAcademicYear();

    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = userSnapshot.val();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userRole = userData.roles?.[0] || "faculty";
    const balanceData = await getOrCreateLeaveBalance(userId, userRole, academicYear);

    const response = NextResponse.json({
      success: true,
      balances: balanceData.balances,
      academicYear: balanceData.academicYear,
    });

    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error("❌ Error fetching leave balances:", error);
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

    let updatedBalance;

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

    // ✅ FIXED: Use / instead of . for Firebase path
    await balanceRef.update({
      [`balances/${leaveType}`]: updatedBalance,
      updatedAt: new Date().toISOString(),
    });

    const updatedSnapshot = await balanceRef.once("value");
    const updatedDoc = updatedSnapshot.val() as LeaveBalancesDoc | null;

    const response = NextResponse.json({
      success: true,
      balances: updatedDoc?.balances || {},
    });

    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    
    return response;
  } catch (error) {
    console.error("❌ Error updating leave balances:", error);
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

    const response = NextResponse.json({
      success: true,
      balances,
      academicYear: year,
    });

    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    
    return response;
  } catch (error) {
    console.error("❌ Error fetching bulk balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch balances" },
      { status: 500 }
    );
  }
}