// app/api/leave/request/[id]/cancel/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import type { LeaveRequest, LeaveStatus } from "@/types/leave";

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface LeaveBalanceDoc {
  userId: string;
  academicYear: string;
  balances: Record<string, LeaveBalance>;
  updatedAt: string;
}

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
): Promise<{ success: boolean; error?: string; balanceBefore?: LeaveBalance; balanceAfter?: LeaveBalance }> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: "Database not initialized" };
  }

  try {
    const academicYear = getCurrentAcademicYear();
    const balanceKey = `${userId}_${academicYear}`;
    const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
    const balanceSnapshot = await balanceRef.once("value");
    let balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

    console.log(`📊 Restoring balance for ${userId}, type ${leaveType}, days ${totalDays}`);
    console.log(`📊 Balance key: ${balanceKey}`);
    console.log(`📊 Balance exists: ${!!balanceDoc}`);

    if (!balanceDoc) {
      console.log(`⚠️ Balance not found for user ${userId}, creating new balance...`);
      
      const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
      const userData = userSnapshot.val() as { roles?: string[] } | null;
      const userRole = userData?.roles?.[0] || "faculty";
      
      const defaultQuotas: Record<string, Record<string, number>> = {
        faculty: { CL: 24, EL: 12, ML: 15, CO: 10 },
        lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8 },
        office_staff: { CL: 20, EL: 10, ML: 15, CO: 8 },
        hod: { CL: 24, EL: 15, ML: 15, CO: 10 },
        registrar: { CL: 20, EL: 12, ML: 15, CO: 10 },
        principal: { CL: 30, EL: 20, ML: 15, CO: 12 },
        head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10 },
      };
      
      const quotas = defaultQuotas[userRole] || defaultQuotas.faculty;
      const newBalances: Record<string, LeaveBalance> = {};
      
      for (const [type, quota] of Object.entries(quotas)) {
        newBalances[type] = {
          allocated: quota,
          used: 0,
          pending: 0,
          available: quota,
        };
      }
      
      if (!newBalances[leaveType]) {
        newBalances[leaveType] = {
          allocated: 0,
          used: 0,
          pending: 0,
          available: 0,
        };
      }
      
      newBalances[leaveType].available += totalDays;
      newBalances[leaveType].pending = Math.max(0, (newBalances[leaveType].pending || 0) - totalDays);
      
      balanceDoc = {
        userId,
        academicYear,
        balances: newBalances,
        updatedAt: new Date().toISOString(),
      };
      
      await balanceRef.set(balanceDoc);
      console.log(`✅ New balance created for user ${userId}`);
      return { 
        success: true, 
        balanceBefore: undefined, 
        balanceAfter: newBalances[leaveType] 
      };
    }

    if (!balanceDoc.balances) {
      balanceDoc.balances = {};
    }

    if (!balanceDoc.balances[leaveType]) {
      console.log(`⚠️ Leave type ${leaveType} not found, creating...`);
      balanceDoc.balances[leaveType] = {
        allocated: 0,
        used: 0,
        pending: 0,
        available: 0,
      };
    }

    const currentBalance = balanceDoc.balances[leaveType];
    const balanceBefore = { ...currentBalance };
    
    const newPending = Math.max(0, (currentBalance.pending || 0) - totalDays);
    const newAvailable = (currentBalance.available || 0) + totalDays;

    console.log(`📊 Current: pending=${currentBalance.pending}, available=${currentBalance.available}`);
    console.log(`📊 New: pending=${newPending}, available=${newAvailable}`);

    await balanceRef.update({
      [`balances.${leaveType}.pending`]: newPending,
      [`balances.${leaveType}.available`]: newAvailable,
      updatedAt: new Date().toISOString(),
    });

    const balanceAfter = { ...currentBalance, pending: newPending, available: newAvailable };

    console.log(`✅ Balance restored for user ${userId}, leave type ${leaveType}`);
    return { success: true, balanceBefore, balanceAfter };
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

    console.log(`🔄 Cancelling request ${id}, restoring balance...`);
    
    const result = await restoreLeaveBalance(
      userId,
      leaveRequest.leaveType,
      leaveRequest.totalDays
    );
    
    const balanceRestored = result.success;
    const balanceError = result.error || null;

    if (result.success) {
      console.log(`✅ Balance restored for cancelled request ${id}`);
    } else {
      console.warn(`⚠️ Could not restore balance for cancelled request ${id}: ${result.error}`);
    }

    const updateData: Record<string, unknown> = {
      status: "Cancelled",
      balanceRestored: true,
      cancelledAt: new Date().toISOString(),
      cancelledBy: userId,
      updatedAt: new Date().toISOString(),
    };

    if (balanceError) {
      updateData.balanceRestoreError = balanceError;
    }

    if (result.balanceBefore && result.balanceAfter) {
      updateData.balanceBeforeCancel = result.balanceBefore;
      updateData.balanceAfterCancel = result.balanceAfter;
    }

    await rtdb.ref(`leaveRequests/${id}`).update(updateData);

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: userId,
      actionByName: leaveRequest.applicantName,
      actionRole: leaveRequest.applicantRoles?.[0] || "staff",
      action: "CANCEL",
      remark: balanceRestored ? `Balance restored: ${leaveRequest.totalDays} days returned to ${leaveRequest.leaveType}` : `Balance restore failed: ${balanceError}`,
      oldStatus: leaveRequest.status,
      newStatus: "Cancelled",
      actionAt: new Date().toISOString(),
    });

    if (leaveRequest.currentApproverId) {
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`notifications/${notificationId}`).set({
        id: notificationId,
        userId: leaveRequest.currentApproverId,
        title: "Leave Request Cancelled",
        message: `${leaveRequest.applicantName} has cancelled their ${leaveRequest.leaveType} leave request. Balance has been ${balanceRestored ? 'restored' : 'NOT restored'}.`,
        type: "leave_cancelled",
        isRead: false,
        metadata: JSON.stringify({
          leaveRequestId: id,
          leaveType: leaveRequest.leaveType,
          balanceRestored: balanceRestored,
          totalDays: leaveRequest.totalDays,
        }),
        createdAt: new Date().toISOString(),
      });
    }

    const responseMessage = balanceRestored 
      ? `Leave request cancelled. ${leaveRequest.totalDays} days restored to ${leaveRequest.leaveType} balance.` 
      : `Leave request cancelled but balance could not be restored: ${balanceError || 'Unknown error'}`;

    return NextResponse.json({
      success: true,
      balanceRestored: balanceRestored,
      totalDaysRestored: balanceRestored ? leaveRequest.totalDays : 0,
      leaveType: leaveRequest.leaveType,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
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