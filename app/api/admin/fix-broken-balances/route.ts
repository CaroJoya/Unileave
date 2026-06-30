// app/api/admin/fix-broken-balances/route.ts
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  totalDays: number;
  status: string;
  balanceRestored?: boolean;
  [key: string]: unknown;
}

interface LeaveBalanceDoc {
  userId: string;
  academicYear: string;
  balances: {
    [key: string]: {
      pending: number;
      available: number;
    };
  };
  updatedAt: string;
}

interface UserData {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  [key: string]: unknown;
}

export async function POST() {
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
    
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as UserData | null;
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized - Super Admin only" }, { status: 403 });
    }

    const requestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = requestsSnapshot.val() as Record<string, LeaveRequest> | null || {};
    
    const brokenRequests: LeaveRequest[] = [];
    const fixedRequests: {
      id: string;
      userId: string;
      userName: string;
      leaveType: string;
      daysRestored: number;
    }[] = [];
    
    for (const [requestId, request] of Object.entries(allRequests)) {
      if (request.status === "Cancelled" && request.balanceRestored !== true) {
        brokenRequests.push({
          id: requestId,
          applicantId: request.applicantId,
          applicantName: request.applicantName || "Unknown User",
          leaveType: request.leaveType,
          totalDays: request.totalDays,
          status: request.status,
          balanceRestored: request.balanceRestored
        });
        
        try {
          const academicYear = getCurrentAcademicYear();
          const balanceKey = `${request.applicantId}_${academicYear}`;
          const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
          const balanceSnapshot = await balanceRef.once("value");
          const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;
          
          if (balanceDoc && balanceDoc.balances && balanceDoc.balances[request.leaveType]) {
            const currentBalance = balanceDoc.balances[request.leaveType];
            const newPending = Math.max(0, (currentBalance.pending || 0) - request.totalDays);
            const newAvailable = (currentBalance.available || 0) + request.totalDays;
            
            await balanceRef.update({
              [`balances.${request.leaveType}.pending`]: newPending,
              [`balances.${request.leaveType}.available`]: newAvailable,
              updatedAt: new Date().toISOString(),
            });
            
            await rtdb.ref(`leaveRequests/${requestId}`).update({
              balanceRestored: true,
              fixedAt: new Date().toISOString(),
              fixedBy: decodedToken.uid,
            });
            
            fixedRequests.push({
              id: requestId,
              userId: request.applicantId,
              userName: request.applicantName || "Unknown User",
              leaveType: request.leaveType,
              daysRestored: request.totalDays
            });
          }
        } catch (fixError) {
          console.error(`Failed to fix request ${requestId}:`, fixError);
        }
      }
    }

    const logId = `fix_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${logId}`).set({
      id: logId,
      userId: decodedToken.uid,
      userName: adminData?.name || "Super Admin",
      userRole: "super_admin",
      action: "BROKEN_BALANCES_FIXED",
      module: "users",
      details: JSON.stringify({
        brokenCount: brokenRequests.length,
        fixedCount: fixedRequests.length,
        fixed: fixedRequests,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedRequests.length} broken balances`,
      brokenCount: brokenRequests.length,
      fixedCount: fixedRequests.length,
      fixed: fixedRequests,
      broken: brokenRequests.map(r => ({
        id: r.id,
        userId: r.applicantId,
        userName: r.applicantName || "Unknown User",
        leaveType: r.leaveType,
        totalDays: r.totalDays
      }))
    });
    
  } catch (error) {
    console.error("Error fixing broken balances:", error);
    return NextResponse.json(
      { error: "Failed to fix broken balances" },
      { status: 500 }
    );
  }
}