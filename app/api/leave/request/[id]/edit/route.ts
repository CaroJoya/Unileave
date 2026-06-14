// app/api/leave/request/[id]/edit/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import { sendEmail, getResubmittedEmail } from "@/lib/utils/email";
import type { LeaveRequest, LeaveStatus } from "@/types/leave";
import type { Role } from "@/types/roles";

const EDITABLE_STATUSES: LeaveStatus[] = ["Pending_HOD", "Pending_Registrar", "Pending_Revision"];

async function getApproverUserId(role: "hod" | "registrar" | "principal", collegeId: string, departmentId?: string): Promise<string | null> {
  if (role === "hod" && departmentId) {
    const deptSnapshot = await rtdb?.ref(`departments/${departmentId}`).once("value");
    const dept = deptSnapshot?.val();
    return dept?.hodId || null;
  }
  
  if (role === "registrar") {
    const usersSnapshot = await rtdb?.ref("users").once("value");
    const users = usersSnapshot?.val() || {};
    for (const [uid, user] of Object.entries(users as Record<string, any>)) {
      if (user.roles?.includes("registrar") && user.collegeId === collegeId) {
        return uid;
      }
    }
    return null;
  }
  
  if (role === "principal") {
    const collegeSnapshot = await rtdb?.ref(`colleges/${collegeId}`).once("value");
    const college = collegeSnapshot?.val();
    return college?.principalId || null;
  }
  
  return null;
}

async function getLeaveTypeConfig(leaveCode: string): Promise<{ deductsBalance: boolean; requiresAttachment: boolean } | null> {
  const typesSnapshot = await rtdb?.ref("leaveTypes").once("value");
  const types = typesSnapshot?.val() || {};
  
  for (const [id, type] of Object.entries(types as Record<string, any>)) {
    if (type.leaveCode === leaveCode && type.isActive) {
      return {
        deductsBalance: type.deductsBalance !== false,
        requiresAttachment: type.requiresAttachment || false,
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // Get existing leave request
    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const existingRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Check if user is the applicant
    if (existingRequest.applicantId !== userId) {
      return NextResponse.json({ error: "Not authorized to edit this request" }, { status: 403 });
    }

    // Check if editable
    if (!EDITABLE_STATUSES.includes(existingRequest.status)) {
      return NextResponse.json({ error: "This request cannot be edited at this stage" }, { status: 400 });
    }

    const body = await request.json();
    const {
      startDate,
      endDate,
      totalDays,
      isHalfDay,
      halfDaySession,
      reason,
      alternateFacultyName,
      attachmentUrl,
    } = body;

    // Validation
    if (!startDate || !totalDays) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!alternateFacultyName || alternateFacultyName.trim() === "") {
      return NextResponse.json({ error: "Alternate faculty name is required" }, { status: 400 });
    }

    // Leave type CANNOT change
    if (body.leaveType && body.leaveType !== existingRequest.leaveType) {
      return NextResponse.json({ error: "Leave type cannot be changed" }, { status: 400 });
    }

    // Calculate difference in days
    const dayDifference = totalDays - existingRequest.totalDays;

    // Update balance if leave type deducts balance and there's a difference
    const leaveTypeConfig = await getLeaveTypeConfig(existingRequest.leaveType);
    if (leaveTypeConfig?.deductsBalance && dayDifference !== 0 && !existingRequest.balanceRestored) {
      const academicYear = getCurrentAcademicYear();
      const balanceKey = `${userId}_${academicYear}`;
      const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
      const balanceSnapshot = await balanceRef.once("value");
      const balanceDoc = balanceSnapshot.val();
      
      if (balanceDoc) {
        const currentAvailable = balanceDoc.balances[existingRequest.leaveType]?.available || 0;
        
        if (dayDifference > 0 && currentAvailable < dayDifference) {
          return NextResponse.json({ error: `Insufficient balance. Need ${dayDifference} more days` }, { status: 400 });
        }
        
        await balanceRef.update({
          [`balances.${existingRequest.leaveType}.pending`]: (balanceDoc.balances[existingRequest.leaveType]?.pending || 0) + dayDifference,
          [`balances.${existingRequest.leaveType}.available`]: currentAvailable - dayDifference,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Determine new status based on routing
    const userRoles = existingRequest.applicantRoles as Role[];
    const route = determineApprover(userRoles, existingRequest.leaveType);
    const approverRole = route.firstApproverRole;
    const approverUserId = await getApproverUserId(approverRole, existingRequest.departmentId ? undefined : undefined, existingRequest.departmentId);
    
    let newStatus: LeaveStatus;
    let newRevisionCount = existingRequest.revisionCount;
    
    if (existingRequest.status === "Pending_Revision") {
      newRevisionCount = existingRequest.revisionCount + 1;
      newStatus = getStatusForApprover(approverRole) as LeaveStatus;
    } else {
      newStatus = existingRequest.status;
    }

    // Update leave request
    await rtdb.ref(`leaveRequests/${id}`).update({
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate || startDate).toISOString(),
      totalDays,
      isHalfDay: isHalfDay || false,
      halfDaySession: halfDaySession || null,
      reason: reason || existingRequest.reason,
      alternateFacultyName,
      attachmentUrl: attachmentUrl || existingRequest.attachmentUrl,
      status: newStatus,
      currentApproverId: approverUserId || existingRequest.currentApproverId,
      revisionCount: newRevisionCount,
      updatedAt: new Date().toISOString(),
    });

    // Create revision history entry if this was a revision
    if (existingRequest.status === "Pending_Revision") {
      const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`revisionHistory/${revisionId}`).set({
        id: revisionId,
        leaveRequestId: id,
        cycleNumber: newRevisionCount,
        remarkSentBy: existingRequest.currentApproverId,
        remarkSentByName: "", // Would need to fetch approver name
        remarkText: "", // Would need the actual remark text
        resubmittedBy: userId,
        resubmittedAt: new Date().toISOString(),
      });
    }

    // Create approval log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: userId,
      actionByName: existingRequest.applicantName,
      actionRole: existingRequest.applicantRoles[0] || "staff",
      action: "RESUBMIT",
      remark: null,
      oldStatus: existingRequest.status,
      newStatus,
      actionAt: new Date().toISOString(),
    });

    // Send email to approver
    if (approverUserId) {
      const approverSnapshot = await rtdb.ref(`users/${approverUserId}`).once("value");
      const approverData = approverSnapshot.val();
      
      if (approverData?.email) {
        const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
        const emailHtml = getResubmittedEmail(existingRequest.applicantName, statusPageUrl);
        await sendEmail({
          to: approverData.email,
          subject: `Resubmitted: Leave Request from ${existingRequest.applicantName}`,
          html: emailHtml,
        });
      }
    }

    return NextResponse.json({ success: true, newStatus });
  } catch (error) {
    console.error("Error editing leave request:", error);
    return NextResponse.json({ error: "Failed to edit leave request" }, { status: 500 });
  }
}