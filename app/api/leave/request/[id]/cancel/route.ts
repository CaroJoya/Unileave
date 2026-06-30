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

const CANCELLABLE_STATUSES: LeaveStatus[] = [
  "Pending_HOD",
  "Pending_Registrar",
  "Pending_Principal",
  "Pending_Revision",
];

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

    // ==========================================
    // ✅ FIX: BALANCE RESTORATION WITH ERROR HANDLING
    // ==========================================
    let balanceRestored = false;

    if (!leaveRequest.balanceRestored) {
      try {
        const academicYear = getCurrentAcademicYear();
        const balanceKey = `${userId}_${academicYear}`;
        const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
        const balanceSnapshot = await balanceRef.once("value");
        const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

        // ✅ Check 1: Balance document exists
        if (!balanceDoc) {
          console.error(`❌ Balance document not found for user ${userId}`);
          return NextResponse.json(
            { 
              error: "Cannot cancel request: Leave balance record not found. Please contact administrator.",
              details: "Balance document missing for user"
            },
            { status: 500 }
          );
        }

        // ✅ Check 2: Balance has balances field
        if (!balanceDoc.balances) {
          console.error(`❌ Balance data corrupted for user ${userId}`);
          return NextResponse.json(
            { 
              error: "Cannot cancel request: Balance data is corrupted. Please contact administrator.",
              details: "Balance document has no balances field"
            },
            { status: 500 }
          );
        }

        // ✅ Check 3: Leave type exists in balance
        const currentBalance = balanceDoc.balances[leaveRequest.leaveType];
        if (!currentBalance) {
          console.error(`❌ Leave type ${leaveRequest.leaveType} not found in balance for user ${userId}`);
          return NextResponse.json(
            { 
              error: `Cannot cancel request: Leave type "${leaveRequest.leaveType}" not found in your balance. Please contact administrator.`,
              details: "Leave type missing from balance"
            },
            { status: 500 }
          );
        }

        // ✅ Check 4: Validate pending amount
        const currentPending = currentBalance.pending || 0;
        const currentAvailable = currentBalance.available || 0;
        
        if (currentPending < leaveRequest.totalDays) {
          console.error(`❌ Balance inconsistency: Pending (${currentPending}) < Days to restore (${leaveRequest.totalDays})`);
          return NextResponse.json(
            { 
              error: "Balance inconsistency detected. Please contact administrator.",
              details: `Pending (${currentPending}) < Total days to restore (${leaveRequest.totalDays})`
            },
            { status: 500 }
          );
        }

        // ✅ Perform the balance update
        const newPending = currentPending - leaveRequest.totalDays;
        const newAvailable = currentAvailable + leaveRequest.totalDays;
        
        await balanceRef.update({
          [`balances.${leaveRequest.leaveType}.pending`]: newPending,
          [`balances.${leaveRequest.leaveType}.available`]: newAvailable,
          updatedAt: new Date().toISOString(),
        });
        
        balanceRestored = true;
        console.log(`✅ Balance restored for user ${userId}, leave type ${leaveRequest.leaveType}`);
        console.log(`   Pending: ${currentPending} → ${newPending}`);
        console.log(`   Available: ${currentAvailable} → ${newAvailable}`);

      } catch (balanceError) {
        // ✅ FIX: Don't proceed - balance restoration failed
        console.error("❌ Error restoring balance during cancel:", balanceError);
        
        // ✅ Log the failure for audit
        const errorLogId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        await rtdb.ref(`errorLogs/${errorLogId}`).set({
          id: errorLogId,
          userId: userId,
          action: "BALANCE_RESTORE_FAILED",
          leaveRequestId: id,
          leaveType: leaveRequest.leaveType,
          totalDays: leaveRequest.totalDays,
          error: balanceError instanceof Error ? balanceError.message : String(balanceError),
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json(
          { 
            error: "Unable to cancel request: Failed to restore leave balance. Please try again or contact administrator.",
            errorId: errorLogId
          },
          { status: 500 }
        );
      }
    } else {
      // Balance was already restored (e.g., from a previous attempt)
      balanceRestored = true;
    }

    // ✅ Final check: Only proceed if balance is restored
    if (!balanceRestored) {
      return NextResponse.json(
        { 
          error: "Cannot cancel request: Balance restoration was not completed. Please contact administrator."
        },
        { status: 500 }
      );
    }

    // ==========================================
    // ✅ NOW CANCEL THE REQUEST (only after balance is restored)
    // ==========================================
    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Cancelled",
      balanceRestored: true, // ✅ Always true now
      cancelledAt: new Date().toISOString(),
      cancelledBy: userId,
      updatedAt: new Date().toISOString(),
    });

    // ✅ Log the cancellation
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

    // ✅ Notify the approver if there is one
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
      balanceRestored: true,
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