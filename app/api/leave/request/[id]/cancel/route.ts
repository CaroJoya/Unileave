// app/api/leave/request/[id]/cancel/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import type { LeaveRequest, LeaveStatus } from "@/types/leave";

interface LeaveTypeConfig {
  deductsBalance: boolean;
}

interface LeaveTypeData {
  leaveCode: string;
  isActive: boolean;
  deductsBalance: boolean;
}

interface LeaveBalanceDoc {
  balances: {
    [key: string]: {
      pending: number;
      available: number;
    };
  };
}

const CANCELLABLE_STATUSES: LeaveStatus[] = [
  "Pending_HOD",
  "Pending_Registrar",
  "Pending_Principal",
  "Pending_Revision",
];

async function getLeaveTypeConfig(leaveCode: string): Promise<LeaveTypeConfig | null> {
  const rtdb = getRTDB();
  if (!rtdb) return null;
  
  const typesSnapshot = await rtdb.ref("leaveTypes").once("value");
  const types = typesSnapshot.val() as Record<string, LeaveTypeData> | null || {};

  for (const [, type] of Object.entries(types)) {
    if (type.leaveCode === leaveCode && type.isActive) {
      return {
        deductsBalance: type.deductsBalance !== false,
      };
    }
  }
  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leaveRequest.applicantId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to cancel this request" },
        { status: 403 }
      );
    }

    if (!CANCELLABLE_STATUSES.includes(leaveRequest.status)) {
      return NextResponse.json(
        { error: "This request cannot be cancelled at this stage" },
        { status: 400 }
      );
    }

    // ✅ FIX: Wrap balance restoration in try-catch to prevent 500
    let balanceRestored = false;
    
    if (!leaveRequest.balanceRestored) {
      try {
        const leaveTypeConfig = await getLeaveTypeConfig(leaveRequest.leaveType);
        if (leaveTypeConfig?.deductsBalance) {
          const academicYear = getCurrentAcademicYear();
          const balanceKey = `${userId}_${academicYear}`;
          const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
          const balanceSnapshot = await balanceRef.once("value");
          const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

          if (balanceDoc && balanceDoc.balances) {
            const currentBalance = balanceDoc.balances[leaveRequest.leaveType];
            if (currentBalance) {
              // ✅ Restore pending and available balance
              const newPending = Math.max(0, (currentBalance.pending || 0) - leaveRequest.totalDays);
              const newAvailable = (currentBalance.available || 0) + leaveRequest.totalDays;
              
              await balanceRef.update({
                [`balances.${leaveRequest.leaveType}.pending`]: newPending,
                [`balances.${leaveRequest.leaveType}.available`]: newAvailable,
                updatedAt: new Date().toISOString(),
              });
              
              balanceRestored = true;
              console.log(`✅ Balance restored for user ${userId}, leave type ${leaveRequest.leaveType}`);
            }
          }
        }
      } catch (balanceError) {
        // ⚠️ Log error but continue with cancellation
        console.error("❌ Error restoring balance during cancel:", balanceError);
        // Don't return an error - the cancellation should still proceed
      }
    } else {
      balanceRestored = true;
    }

    // ✅ Cancel the request regardless of balance restoration status
    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Cancelled",
      balanceRestored: balanceRestored || leaveRequest.balanceRestored,
      cancelledAt: new Date().toISOString(),
      cancelledBy: userId,
      updatedAt: new Date().toISOString(),
    });

    // Log the cancellation
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: userId,
      actionByName: leaveRequest.applicantName,
      actionRole: leaveRequest.applicantRoles[0] || "staff",
      action: "CANCEL",
      remark: null,
      oldStatus: leaveRequest.status,
      newStatus: "Cancelled",
      actionAt: new Date().toISOString(),
    });

    // Notify the approver if there is one
    if (leaveRequest.currentApproverId) {
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`notifications/${notificationId}`).set({
        id: notificationId,
        userId: leaveRequest.currentApproverId,
        title: "Leave Request Cancelled",
        message: `${leaveRequest.applicantName} has cancelled their ${leaveRequest.leaveType} leave request.`,
        type: "leave_cancelled",
        isRead: false,
        metadata: JSON.stringify({
          leaveRequestId: id,
          leaveType: leaveRequest.leaveType,
        }),
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ 
      success: true,
      balanceRestored: balanceRestored,
      message: "Leave request cancelled successfully" 
    });
  } catch (error) {
    console.error("Error cancelling leave request:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel leave request" },
      { status: 500 }
    );
  }
}