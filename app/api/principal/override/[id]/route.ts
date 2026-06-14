// app/api/principal/override/[id]/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
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
  approvedBy?: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
}

interface LeaveTypeConfig {
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

async function getLeaveTypeConfig(leaveCode: string): Promise<LeaveTypeConfig | null> {
  const typesSnapshot = await rtdb?.ref("leaveTypes").once("value");
  const types = typesSnapshot?.val() as Record<string, { leaveCode: string; deductsBalance: boolean; isActive: boolean }> | null || {};
  
  for (const [, type] of Object.entries(types)) {
    if (type.leaveCode === leaveCode && type.isActive) {
      return { deductsBalance: type.deductsBalance !== false };
    }
  }
  return null;
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim() === "") {
      return NextResponse.json({ error: "Override reason is required" }, { status: 400 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as User | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    // Get leave request
    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Validate override eligibility
    const validLeaveTypes = ["CL", "EL", "ML"];
    if (!validLeaveTypes.includes(leaveRequest.leaveType)) {
      return NextResponse.json({ error: "This leave type cannot be overridden" }, { status: 400 });
    }

    if (leaveRequest.status !== "Approved") {
      return NextResponse.json({ error: "Only approved requests can be overridden" }, { status: 400 });
    }

    if (leaveRequest.approvedBy !== "hod" && leaveRequest.approvedBy !== "registrar") {
      return NextResponse.json({ error: "Only HOD or Registrar approved requests can be overridden" }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(leaveRequest.startDate) <= today) {
      return NextResponse.json({ error: "Cannot override leave that has already started" }, { status: 400 });
    }

    // Restore balance if leave type deducts balance
    const leaveTypeConfig = await getLeaveTypeConfig(leaveRequest.leaveType);
    if (leaveTypeConfig?.deductsBalance) {
      const academicYear = getCurrentAcademicYear();
      const balanceKey = `${leaveRequest.applicantId}_${academicYear}`;
      const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
      const balanceSnapshot = await balanceRef.once("value");
      const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;
      
      if (balanceDoc && balanceDoc.balances[leaveRequest.leaveType]) {
        await balanceRef.update({
          [`balances.${leaveRequest.leaveType}.pending`]: Math.max(0, 
            (balanceDoc.balances[leaveRequest.leaveType].pending || 0) - leaveRequest.totalDays
          ),
          [`balances.${leaveRequest.leaveType}.available`]: 
            (balanceDoc.balances[leaveRequest.leaveType].available || 0) + leaveRequest.totalDays,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Update leave request status
    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Rejected_Principal",
      overriddenBy: principalId,
      overriddenAt: new Date().toISOString(),
      overrideReason: reason,
      balanceRestored: leaveTypeConfig?.deductsBalance === true,
      updatedAt: new Date().toISOString(),
    });

    // Create approval log for override
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: principalId,
      actionByName: principalData.name,
      actionRole: "principal",
      action: "PRINCIPAL_OVERRIDE",
      remark: reason,
      oldStatus: "Approved",
      newStatus: "Rejected_Principal",
      actionAt: new Date().toISOString(),
    });

    // Create audit log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: principalId,
      userName: principalData.name,
      userRole: "principal",
      action: "PRINCIPAL_OVERRIDE",
      module: "leaveRequests",
      targetId: id,
      targetUser: leaveRequest.applicantId,
      details: {
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
        originalApprover: leaveRequest.approvedBy,
        overrideReason: reason,
      },
      createdAt: new Date().toISOString(),
    });

    // Create notification for applicant ONLY (no HOD/Registrar)
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Leave Request Overridden",
      message: `Your ${leaveRequest.leaveType} leave request has been overridden by Principal. Reason: ${reason}`,
      type: "principal_override",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    // Send email to applicant ONLY (no HOD/Registrar)
    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      await sendEmail({
        to: applicantData.email,
        subject: `Leave Request Overridden - ${leaveRequest.leaveType}`,
        html: getLeaveRejectedEmail(
          leaveRequest.applicantName,
          leaveRequest.leaveType,
          leaveRequest.startDate,
          leaveRequest.endDate,
          `Your approved leave request has been overridden by the Principal. Reason: ${reason}`,
          principalData.name
        ),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error overriding leave request:", error);
    return NextResponse.json({ error: "Failed to override leave request" }, { status: 500 });
  }
}