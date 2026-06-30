// app/api/leave/request/[id]/cancel/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import type { LeaveRequest, LeaveStatus } from "@/types/leave";

interface LeaveBalanceDoc {
  balances: {
    [key: string]: {
      pending: number;
      available: number;
    };
  };
}

// ❌ REMOVED: LeaveBalanceResponse interface (not used)

const CANCELLABLE_STATUSES: LeaveStatus[] = [
  "Pending_HOD",
  "Pending_Registrar",
  "Pending_Principal",
  "Pending_Revision",
];

async function restoreLeaveBalance(
  userId: string,
  leaveType: string,
  totalDays: number
): Promise<{ success: boolean; error?: string }> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: "Database not initialized" };
  }

  try {
    const academicYear = getCurrentAcademicYear();
    const balanceKey = `${userId}_${academicYear}`;
    const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
    const balanceSnapshot = await balanceRef.once("value");
    const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

    if (!balanceDoc) {
      console.warn(`⚠️ No balance document found for ${userId} in ${academicYear}`);
      return { success: false, error: "Balance document not found" };
    }

    if (!balanceDoc.balances || !balanceDoc.balances[leaveType]) {
      console.warn(`⚠️ No balance for leave type ${leaveType} for user ${userId}`);
      return { success: false, error: `Balance for ${leaveType} not found` };
    }

    const currentBalance = balanceDoc.balances[leaveType];
    const newPending = Math.max(0, (currentBalance.pending || 0) - totalDays);
    const newAvailable = (currentBalance.available || 0) + totalDays;

    await balanceRef.update({
      [`balances.${leaveType}.pending`]: newPending,
      [`balances.${leaveType}.available`]: newAvailable,
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Balance restored for user ${userId}, leave type ${leaveType}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error restoring balance:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
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

    // Get the leave request
    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Authorization check
    if (leaveRequest.applicantId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to cancel this request" },
        { status: 403 }
      );
    }

    // Status check
    if (!CANCELLABLE_STATUSES.includes(leaveRequest.status)) {
      return NextResponse.json(
        { error: "This request cannot be cancelled at this stage" },
        { status: 400 }
      );
    }

    // Try to restore balance
    let balanceRestored = false;
    let balanceError = null;

    if (!leaveRequest.balanceRestored) {
      const result = await restoreLeaveBalance(
        userId,
        leaveRequest.leaveType,
        leaveRequest.totalDays
      );
      
      balanceRestored = result.success;
      balanceError = result.error;

      if (result.success) {
        console.log(`✅ Balance restored for cancelled request ${id}`);
      } else {
        console.warn(`⚠️ Could not restore balance for cancelled request ${id}: ${result.error}`);
        // Continue with cancellation even if balance restore fails
      }
    } else {
      balanceRestored = true;
      console.log(`✅ Balance already marked as restored for request ${id}`);
    }

    // Update the leave request status
    const updateData: Record<string, unknown> = {
      status: "Cancelled",
      balanceRestored: balanceRestored,
      cancelledAt: new Date().toISOString(),
      cancelledBy: userId,
      updatedAt: new Date().toISOString(),
    };

    // If balance restore failed, store the error in the request
    if (balanceError) {
      updateData.balanceRestoreError = balanceError;
    }

    await rtdb.ref(`leaveRequests/${id}`).update(updateData);

    // Log the cancellation
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: userId,
      actionByName: leaveRequest.applicantName,
      actionRole: leaveRequest.applicantRoles?.[0] || "staff",
      action: "CANCEL",
      remark: balanceRestored ? null : `Balance restore failed: ${balanceError}`,
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
          balanceRestored: balanceRestored,
        }),
        createdAt: new Date().toISOString(),
      });
    }

    // Return response
    const responseMessage = balanceRestored 
      ? "Leave request cancelled successfully" 
      : `Leave request cancelled but balance could not be restored: ${balanceError || 'Unknown error'}`;

    return NextResponse.json({
      success: true,
      balanceRestored: balanceRestored,
      message: responseMessage,
      ...(balanceError && { balanceError }),
    });

  } catch (error) {
    console.error("❌ Error cancelling leave request:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel leave request";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}