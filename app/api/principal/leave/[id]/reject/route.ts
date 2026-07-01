// app/api/principal/leave/[id]/reject/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { restoreLeaveBalance } from "@/lib/services/leave-balance-service";
import { sendEmail, getLeaveRejectedEmail } from "@/lib/utils/email";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  departmentId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  deductsBalance?: boolean;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
}

export async function POST(
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

    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim() === "") {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as User | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leaveRequest.status !== "Pending_Principal") {
      return NextResponse.json({ error: "Request is not pending principal approval" }, { status: 400 });
    }

    // ============ CRITICAL: Skip balance restoration for OD ============
    const isOD = leaveRequest.leaveType === "OD";
    const shouldRestoreBalance = !isOD && leaveRequest.deductsBalance !== false;

    // ============ BALANCE RESTORATION (CONDITIONAL) ============
    
    let balanceRestored = false;
    let balanceError: string | null = null;

    if (shouldRestoreBalance) {
      console.log(`🔄 Restoring balance for ${leaveRequest.leaveType} (deducts balance: true)`);
      const result = await restoreLeaveBalance(
        leaveRequest.applicantId,
        leaveRequest.leaveType,
        leaveRequest.totalDays
      );
      
      if (result.success) {
        balanceRestored = true;
        console.log(`✅ Balance restored for user ${leaveRequest.applicantId}`);
      } else {
        balanceError = result.error || "Unknown error";
        console.warn(`⚠️ Could not restore balance: ${balanceError}`);
      }
    } else if (isOD) {
      console.log(`ℹ️ OD leave rejected - No balance to restore (OD doesn't deduct)`);
    } else {
      console.log(`ℹ️ Leave type ${leaveRequest.leaveType} does not deduct balance, skipping restoration`);
    }

    // ============ UPDATE REQUEST - ✅ FIX: STATUS FIRST ============
    const newStatus = "Rejected_Principal";
    await rtdb.ref(`leaveRequests/${id}`).update({
      status: newStatus,
      balanceRestored: balanceRestored,
      balanceRestoreError: balanceError,
      updatedAt: new Date().toISOString(),
    });

    // ============ LOG ACTION ============

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: principalId,
      actionByName: principalData.name,
      actionRole: "principal",
      action: "REJECT",
      remark: isOD ? "OD rejected - No balance to restore" : reason,
      oldStatus: "Pending_Principal",
      newStatus,
      actionAt: new Date().toISOString(),
    });

    // ============ SEND NOTIFICATION ============

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Leave Request Rejected",
      message: `Your ${isOD ? "On Duty" : leaveRequest.leaveType} leave request has been rejected by Principal. Reason: ${reason}`,
      type: "leave_rejected",
      isRead: false,
      metadata: JSON.stringify({
        leaveRequestId: id,
        leaveType: leaveRequest.leaveType,
        reason,
        balanceRestored,
        isOD: isOD,
      }),
      createdAt: new Date().toISOString(),
    });

    // ============ SEND EMAIL ============

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      const emailHtml = getLeaveRejectedEmail(
        leaveRequest.applicantName,
        isOD ? "On Duty (OD)" : leaveRequest.leaveType,
        leaveRequest.startDate,
        leaveRequest.endDate,
        reason,
        principalData.name
      );
      
      await sendEmail(
        applicantData.email,
        `Leave Request Rejected - ${isOD ? "On Duty" : leaveRequest.leaveType}`,
        emailHtml
      ).catch(err => console.error("❌ Failed to send rejection email:", err));
    }

    return NextResponse.json({ 
      success: true,
      balanceRestored,
      message: isOD 
        ? "On Duty request rejected. No balance to restore." 
        : balanceRestored 
          ? `Leave request rejected. Balance restored.` 
          : `Leave request rejected. ${balanceError ? `Balance not restored: ${balanceError}` : 'Balance not restored.'}`
    });
  } catch (error) {
    console.error("Error rejecting leave request:", error);
    return NextResponse.json({ error: "Failed to reject leave request" }, { status: 500 });
  }
}