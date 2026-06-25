// app/api/principal/override/[id]/route.ts - COMPLETE FILE
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
  collegeId?: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId?: string;
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

// 🆕 Helper to get HOD ID
async function getHODId(departmentId: string): Promise<string | null> {
  if (!rtdb) return null;
  const deptSnapshot = await rtdb.ref(`departments/${departmentId}`).once("value");
  const dept = deptSnapshot.val() as { hodId: string | null } | null;
  return dept?.hodId || null;
}

// 🆕 Helper to get Registrar ID
async function getRegistrarId(collegeId: string): Promise<string | null> {
  if (!rtdb) return null;
  const usersSnapshot = await rtdb.ref("users").once("value");
  const users = usersSnapshot.val() as Record<string, { roles: string[]; collegeId: string }> | null || {};
  
  for (const [uid, user] of Object.entries(users)) {
    if (user.roles?.includes("registrar") && user.collegeId === collegeId) {
      return uid;
    }
  }
  return null;
}

async function getLeaveTypeConfig(leaveCode: string): Promise<LeaveTypeConfig | null> {
  if (!rtdb) return null;
  const typesSnapshot = await rtdb.ref("leaveTypes").once("value");
  const types = typesSnapshot.val() as Record<string, { leaveCode: string; deductsBalance: boolean; isActive: boolean }> | null || {};
  
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

    // Get applicant's college ID
    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as { collegeId: string } | null;
    const collegeId = applicantData?.collegeId || principalData.collegeId || "";

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
      details: JSON.stringify({
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
        originalApprover: leaveRequest.approvedBy,
        overrideReason: reason,
      }),
      createdAt: new Date().toISOString(),
    });

    // 🆕 1. Create notification for applicant
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Leave Request Overridden",
      message: `Your ${leaveRequest.leaveType} leave request has been overridden by Principal. Reason: ${reason}`,
      type: "principal_override",
      isRead: false,
      metadata: JSON.stringify({
        leaveRequestId: id,
        leaveType: leaveRequest.leaveType,
        overrideReason: reason,
      }),
      createdAt: new Date().toISOString(),
    });

    // 🆕 2. Create notification for original approver (HOD or Registrar)
    let originalApproverId: string | null = null;
    if (leaveRequest.approvedBy === "hod") {
      originalApproverId = await getHODId(leaveRequest.departmentId);
    } else if (leaveRequest.approvedBy === "registrar" && collegeId) {
      originalApproverId = await getRegistrarId(collegeId);
    }

    if (originalApproverId) {
      const approverNotifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`notifications/${approverNotifId}`).set({
        id: approverNotifId,
        userId: originalApproverId,
        title: "Your Approved Leave Was Overridden",
        message: `The Principal has overridden the ${leaveRequest.leaveType} leave request you approved for ${leaveRequest.applicantName}. Reason: ${reason}`,
        type: "principal_override",
        isRead: false,
        metadata: JSON.stringify({
          leaveRequestId: id,
          applicantId: leaveRequest.applicantId,
          originalApproverRole: leaveRequest.approvedBy,
          overrideReason: reason,
        }),
        createdAt: new Date().toISOString(),
      });
    }

    // Send email to applicant
    const applicantEmailSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantEmailData = applicantEmailSnapshot.val() as User | null;

    if (applicantEmailData?.email) {
      await sendEmail({
        to: applicantEmailData.email,
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