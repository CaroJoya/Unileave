// app/api/registrar/leave/[id]/approve/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getLeaveApprovedEmail } from "@/lib/utils/email";
import { createNotification } from "@/lib/services/notification-service";
import { createAuditLog } from "@/lib/services/audit-service";
import { NotificationType } from "@/lib/constants/notification-types";
import { finalizeApproval } from "@/lib/services/leave-balance-service";

interface CompOffUsageRecord {
  id: string;
  creditId: string;
  leaveRequestId: string;
  userId: string;
  daysUsed: number;
  status: "pending" | "approved" | "rejected";
  usedAt: string;
  updatedAt?: string;
}

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantRoles: string[];
  departmentId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  currentApproverId: string | null;
  revisionCount: number;
  compOffCreditsUsed?: {
    creditId: string;
    daysUsed: number;
  };
  deductsBalance?: boolean;
  odDetails?: {
    eventName: string;
    organization: string;
    location: string;
    purpose: string;
  };
}

interface CompOffCredit {
  id: string;
  userId: string;
  creditedDays: number;
  usedDays: number;
  status: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  status: string;
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

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leaveRequest.status !== "Pending_Registrar") {
      return NextResponse.json({ error: "Request is not pending registrar approval" }, { status: 400 });
    }

    // ============ CRITICAL: Skip balance deduction for OD ============
    const isOD = leaveRequest.leaveType === "OD";
    const shouldDeductBalance = !isOD && leaveRequest.deductsBalance !== false;

    // ============ UPDATE COMP-OFF CREDIT USAGE (if CO) ============
    
    if (leaveRequest.leaveType === "CO" && leaveRequest.compOffCreditsUsed) {
      const { creditId, daysUsed } = leaveRequest.compOffCreditsUsed;
      const creditRef = rtdb.ref(`compOffCredits/${creditId}`);
      const creditSnapshot = await creditRef.once('value');
      const credit = creditSnapshot.val() as CompOffCredit | null;
      
      if (credit) {
        const newUsedDays = (credit.usedDays || 0) + daysUsed;
        const isFullyUsed = newUsedDays >= credit.creditedDays;
        
        await creditRef.update({
          usedDays: newUsedDays,
          status: isFullyUsed ? 'fully_used' : 'active',
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`✅ Comp-off credit ${creditId} updated: usedDays=${newUsedDays}, status=${isFullyUsed ? 'fully_used' : 'active'}`);
        
        const usageSnapshot = await rtdb.ref('compOffUsage').once('value');
        const allUsage = usageSnapshot.val() as Record<string, CompOffUsageRecord> | null | undefined;
        
        if (allUsage) {
          for (const [usageId, usage] of Object.entries(allUsage)) {
            if (usage.creditId === creditId && usage.leaveRequestId === id && usage.status === 'pending') {
              await rtdb.ref(`compOffUsage/${usageId}`).update({
                status: 'approved',
                updatedAt: new Date().toISOString(),
              });
              break;
            }
          }
        }
      }
    }

    // ============ UPDATE LEAVE REQUEST - ✅ FIX: STATUS FIRST ============
    
    const newStatus = "Approved";
    await rtdb.ref(`leaveRequests/${id}`).update({
      status: newStatus,
      approvedBy: "registrar",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // ============ UPDATE BALANCE - ✅ FIX: NOW UPDATE BALANCE ============
    if (shouldDeductBalance) {
      console.log(`✅ Finalizing approval for ${leaveRequest.leaveType} leave (${leaveRequest.totalDays} days)`);
      await finalizeApproval(
        leaveRequest.applicantId,
        leaveRequest.leaveType,
        leaveRequest.totalDays
      );
    } else if (isOD) {
      console.log(`ℹ️ OD leave approved - No balance deducted`);
    }

    // ============ LOG ACTION ============

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: registrarId,
      actionByName: registrarData.name,
      actionRole: "registrar",
      action: "APPROVE",
      remark: isOD ? "OD approved - No balance deducted" : null,
      oldStatus: "Pending_Registrar",
      newStatus,
      actionAt: new Date().toISOString(),
      compOffCreditUsed: leaveRequest.compOffCreditsUsed || null,
    });

    // ============ SEND NOTIFICATION ============

    const notificationMessage = isOD
      ? `Your On Duty request (${new Date(leaveRequest.startDate).toLocaleDateString()}) has been approved by Registrar ${registrarData.name}. (No balance deducted)`
      : `Your ${leaveRequest.leaveType} leave request (${new Date(leaveRequest.startDate).toLocaleDateString()} - ${new Date(leaveRequest.endDate).toLocaleDateString()}) has been approved by Registrar ${registrarData.name}.`;

    await createNotification({
      userId: leaveRequest.applicantId,
      type: NotificationType.LEAVE_APPROVED,
      message: notificationMessage,
      metadata: {
        leaveRequestId: id,
        approver: "registrar",
        approverName: registrarData.name,
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
        compOffCreditUsed: leaveRequest.compOffCreditsUsed || null,
        isOD: isOD,
        balanceDeducted: shouldDeductBalance,
      },
    });

    // ============ AUDIT LOG ============

    await createAuditLog({
      userId: registrarId,
      userName: registrarData.name,
      userRole: "registrar",
      action: "LEAVE_APPROVED",
      module: "leaveRequests",
      targetId: id,
      targetUser: leaveRequest.applicantId,
      details: {
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        compOffCreditUsed: leaveRequest.compOffCreditsUsed || null,
        isOD: isOD,
        balanceDeducted: shouldDeductBalance,
      },
    });

    // ============ SEND EMAIL ============

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      const emailHtml = getLeaveApprovedEmail(
        leaveRequest.applicantName,
        isOD ? "On Duty (OD)" : leaveRequest.leaveType,
        leaveRequest.startDate,
        leaveRequest.endDate,
        leaveRequest.totalDays,
        registrarData.name
      );
      
      await sendEmail(
        applicantData.email,
        `Leave Request Approved - ${isOD ? "On Duty" : leaveRequest.leaveType}`,
        emailHtml
      ).catch(err => console.error("❌ Failed to send approval email:", err));
    }

    // ============ COMP-OFF SPECIFIC NOTIFICATION ============
    if (leaveRequest.leaveType === "CO" && leaveRequest.compOffCreditsUsed) {
      const creditId = leaveRequest.compOffCreditsUsed.creditId;
      const creditSnap = await rtdb.ref(`compOffCredits/${creditId}`).once('value');
      const credit = creditSnap.val() as CompOffCredit | null;
      
      if (credit) {
        await createNotification({
          userId: leaveRequest.applicantId,
          type: NotificationType.COMPOFF_APPROVED,
          message: `Your comp-off request for ${leaveRequest.totalDays} day(s) has been approved by Registrar. ${credit.status === 'fully_used' ? 'All credits have been used.' : `${credit.creditedDays - credit.usedDays} day(s) remaining.`}`,
          metadata: {
            leaveRequestId: id,
            creditId: creditId,
            usedDays: credit.usedDays,
            remainingDays: credit.creditedDays - credit.usedDays,
            status: credit.status,
          },
        });
      }
    }

    return NextResponse.json({ 
      success: true,
      message: isOD 
        ? "On Duty request approved successfully (No balance deducted)" 
        : "Leave request approved successfully",
    });
  } catch (error) {
    console.error("Error approving leave request:", error);
    return NextResponse.json({ error: "Failed to approve leave request" }, { status: 500 });
  }
}