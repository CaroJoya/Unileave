// app/api/principal/override/[id]/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
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

interface LeaveBalanceDoc {
  balances: {
    [key: string]: {
      pending: number;
      available: number;
    };
  };
}

async function getHODId(departmentId: string): Promise<string | null> {
  const rtdb = getRTDB();
  if (!rtdb) return null;
  const deptSnapshot = await rtdb.ref(`departments/${departmentId}`).once("value");
  const dept = deptSnapshot.val() as { hodId: string | null } | null;
  return dept?.hodId || null;
}

async function getRegistrarId(collegeId: string): Promise<string | null> {
  const rtdb = getRTDB();
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
      return NextResponse.json({ error: "Override reason is required" }, { status: 400 });
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

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as { collegeId: string } | null;
    const leaveCollegeId = applicantData?.collegeId || leaveRequest.collegeId;

    if (leaveCollegeId !== principalData.collegeId) {
      return NextResponse.json(
        { error: "Not authorized to override requests from other colleges" },
        { status: 403 }
      );
    }

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

    const collegeId = leaveCollegeId || principalData.collegeId || "";

    const academicYear = getCurrentAcademicYear();
    const balanceKey = `${leaveRequest.applicantId}_${academicYear}`;
    const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
    const balanceSnapshot = await balanceRef.once("value");
    const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;
    
    if (balanceDoc && balanceDoc.balances[leaveRequest.leaveType]) {
      const currentPending = balanceDoc.balances[leaveRequest.leaveType].pending || 0;
      const currentAvailable = balanceDoc.balances[leaveRequest.leaveType].available || 0;
      
      // ✅ FIXED: Use / instead of . for Firebase path
      await balanceRef.update({
        [`balances/${leaveRequest.leaveType}/pending`]: Math.max(0, currentPending - leaveRequest.totalDays),
        [`balances/${leaveRequest.leaveType}/available`]: currentAvailable + leaveRequest.totalDays,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`✅ Balance restored for user ${leaveRequest.applicantId}, leave type ${leaveRequest.leaveType}`);
    } else {
      console.log(`⚠️ Balance not found for user ${leaveRequest.applicantId}, creating balance...`);
      const userSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
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
      const newBalances: Record<string, { allocated: number; used: number; pending: number; available: number }> = {};
      
      for (const [type, quota] of Object.entries(quotas)) {
        newBalances[type] = {
          allocated: quota,
          used: 0,
          pending: 0,
          available: quota,
        };
      }
      
      if (!newBalances[leaveRequest.leaveType]) {
        newBalances[leaveRequest.leaveType] = {
          allocated: 0,
          used: 0,
          pending: 0,
          available: 0,
        };
      }
      
      newBalances[leaveRequest.leaveType].available += leaveRequest.totalDays;
      
      await balanceRef.set({
        userId: leaveRequest.applicantId,
        academicYear,
        balances: newBalances,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`✅ Balance created for user ${leaveRequest.applicantId}`);
    }

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Rejected_Principal",
      overriddenBy: principalId,
      overriddenAt: new Date().toISOString(),
      overrideReason: reason,
      balanceRestored: true,
      updatedAt: new Date().toISOString(),
    });

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
        collegeId: collegeId,
      }),
      createdAt: new Date().toISOString(),
    });

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

    const applicantEmailSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantEmailData = applicantEmailSnapshot.val() as User | null;

    if (applicantEmailData?.email) {
      await sendEmail(
        applicantEmailData.email,
        `Leave Request Overridden - ${leaveRequest.leaveType}`,
        getLeaveRejectedEmail(
          leaveRequest.applicantName,
          leaveRequest.leaveType,
          leaveRequest.startDate,
          leaveRequest.endDate,
          `Your approved leave request has been overridden by the Principal. Reason: ${reason}`,
          principalData.name
        )
      ).catch(err => console.error("❌ Failed to send override email:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error overriding leave request:", error);
    return NextResponse.json({ error: "Failed to override leave request" }, { status: 500 });
  }
}