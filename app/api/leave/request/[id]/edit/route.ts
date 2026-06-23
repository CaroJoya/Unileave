// app/api/leave/request/[id]/edit/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import { sendEmail, getResubmittedEmail } from "@/lib/utils/email";
import type { LeaveRequest, LeaveStatus } from "@/types/leave";
import type { Role } from "@/types/roles";

// Type definitions
interface UserData {
  roles?: string[];
  collegeId: string;
  name?: string;
  email?: string;
}

interface DepartmentData {
  hodId: string | null;
}

interface RegistrarUserData {
  roles?: string[];
  collegeId: string;
}

interface CollegeData {
  principalId: string | null;
}

interface LeaveTypeConfig {
  deductsBalance: boolean;
  requiresAttachment: boolean;
}

interface LeaveTypeData {
  leaveCode: string;
  isActive: boolean;
  deductsBalance: boolean;
  requiresAttachment: boolean;
}

interface LeaveBalanceDoc {
  balances: {
    [key: string]: {
      pending: number;
      available: number;
    };
  };
}

const EDITABLE_STATUSES: LeaveStatus[] = [
  "Pending_HOD",
  "Pending_Registrar",
  "Pending_Revision",
];

async function getApproverUserId(
  role: "hod" | "registrar" | "principal",
  collegeId: string,
  departmentId?: string
): Promise<string | null> {
  if (role === "hod" && departmentId) {
    const deptSnapshot = await rtdb?.ref(`departments/${departmentId}`).once("value");
    const dept = deptSnapshot?.val() as DepartmentData | null;
    return dept?.hodId || null;
  }

  if (role === "registrar") {
    const usersSnapshot = await rtdb?.ref("users").once("value");
    const users = usersSnapshot?.val() as Record<string, RegistrarUserData> | null || {};
    for (const [uid, user] of Object.entries(users)) {
      if (user.roles?.includes("registrar") && user.collegeId === collegeId) {
        return uid;
      }
    }
    return null;
  }

  if (role === "principal") {
    const collegeSnapshot = await rtdb?.ref(`colleges/${collegeId}`).once("value");
    const college = collegeSnapshot?.val() as CollegeData | null;
    return college?.principalId || null;
  }

  return null;
}

async function getLeaveTypeConfig(leaveCode: string): Promise<LeaveTypeConfig | null> {
  const typesSnapshot = await rtdb?.ref("leaveTypes").once("value");
  const types = typesSnapshot?.val() as Record<string, LeaveTypeData> | null || {};

  for (const [, type] of Object.entries(types)) {
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

    // Get user data to get collegeId
    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = userSnapshot.val() as UserData | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get existing leave request
    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const existingRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Check if user is the applicant
    if (existingRequest.applicantId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to edit this request" },
        { status: 403 }
      );
    }

    // Check if editable
    if (!EDITABLE_STATUSES.includes(existingRequest.status)) {
      return NextResponse.json(
        { error: "This request cannot be edited at this stage" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Alternate faculty name is required" },
        { status: 400 }
      );
    }

    if (alternateFacultyName.trim().length < 3) {
      return NextResponse.json(
        { error: "Alternate faculty name must be at least 3 characters" },
        { status: 400 }
      );
    }

    // Leave type CANNOT change
    if (body.leaveType && body.leaveType !== existingRequest.leaveType) {
      return NextResponse.json(
        { error: "Leave type cannot be changed" },
        { status: 400 }
      );
    }

    // Calculate difference in days
    const dayDifference = totalDays - existingRequest.totalDays;

    // Update balance if leave type deducts balance and there's a difference
    const leaveTypeConfig = await getLeaveTypeConfig(existingRequest.leaveType);
    if (
      leaveTypeConfig?.deductsBalance &&
      dayDifference !== 0 &&
      !existingRequest.balanceRestored
    ) {
      const academicYear = getCurrentAcademicYear();
      const balanceKey = `${userId}_${academicYear}`;
      const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
      const balanceSnapshot = await balanceRef.once("value");
      const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

      if (balanceDoc) {
        const currentAvailable = balanceDoc.balances[existingRequest.leaveType]?.available || 0;

        if (dayDifference > 0 && currentAvailable < dayDifference) {
          return NextResponse.json(
            { error: `Insufficient balance. Need ${dayDifference} more days` },
            { status: 400 }
          );
        }

        await balanceRef.update({
          [`balances.${existingRequest.leaveType}.pending`]:
            (balanceDoc.balances[existingRequest.leaveType]?.pending || 0) + dayDifference,
          [`balances.${existingRequest.leaveType}.available`]:
            currentAvailable - dayDifference,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Determine new status based on routing
    let newStatus: LeaveStatus = existingRequest.status;
    let newRevisionCount = existingRequest.revisionCount || 0;

    if (existingRequest.status === "Pending_Revision") {
      // Resubmit after remarks - go back to original approver
      const userRoles = existingRequest.applicantRoles as Role[];
      const route = determineApprover(userRoles, existingRequest.leaveType);
      const approverRole = route.firstApproverRole;
      // Use userData.collegeId instead of existingRequest.collegeId
      const approverUserId = await getApproverUserId(
        approverRole,
        userData.collegeId || "",
        existingRequest.departmentId
      );

      newStatus = getStatusForApprover(approverRole) as LeaveStatus;
      newRevisionCount = existingRequest.revisionCount + 1;

      // Update current approver
      if (approverUserId) {
        await rtdb.ref(`leaveRequests/${id}`).update({
          currentApproverId: approverUserId,
        });
      }

      // Create revision history entry
      const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`revisionHistory/${revisionId}`).set({
        id: revisionId,
        leaveRequestId: id,
        cycleNumber: newRevisionCount,
        remarkSentBy: existingRequest.currentApproverId,
        remarkSentByName: "", // We don't have the approver name easily here
        remarkText: "Resubmitted after revision",
        resubmittedBy: userId,
        resubmittedAt: new Date().toISOString(),
      });
    }

    // Update leave request
    await rtdb.ref(`leaveRequests/${id}`).update({
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate || startDate).toISOString(),
      totalDays,
      isHalfDay: isHalfDay || false,
      halfDaySession: halfDaySession || null,
      reason: reason || existingRequest.reason,
      alternateFacultyName: alternateFacultyName.trim(),
      attachmentUrl: attachmentUrl || existingRequest.attachmentUrl,
      status: newStatus,
      revisionCount: newRevisionCount,
      updatedAt: new Date().toISOString(),
    });

    // Create approval log for resubmission
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: userId,
      actionByName: existingRequest.applicantName,
      actionRole: existingRequest.applicantRoles[0] || "staff",
      action: existingRequest.status === "Pending_Revision" ? "RESUBMIT" : "EDIT",
      remark: null,
      oldStatus: existingRequest.status,
      newStatus,
      actionAt: new Date().toISOString(),
    });

    // Send email to approver if resubmitting
    if (existingRequest.status === "Pending_Revision") {
      // Get the approver ID based on the new status
      const userRoles = existingRequest.applicantRoles as Role[];
      const route = determineApprover(userRoles, existingRequest.leaveType);
      const approverRole = route.firstApproverRole;
      // Use userData.collegeId instead of existingRequest.collegeId
      const approverId = await getApproverUserId(
        approverRole,
        userData.collegeId || "",
        existingRequest.departmentId
      );

      if (approverId) {
        const approverSnapshot = await rtdb.ref(`users/${approverId}`).once("value");
        const approverData = approverSnapshot.val() as UserData | null;

        if (approverData?.email) {
          const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
          const emailHtml = getResubmittedEmail(
            existingRequest.applicantName,
            statusPageUrl
          );
          await sendEmail({
            to: approverData.email,
            subject: `Resubmitted: Leave Request from ${existingRequest.applicantName}`,
            html: emailHtml,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      newStatus,
      message:
        existingRequest.status === "Pending_Revision"
          ? "Request resubmitted successfully"
          : "Request updated successfully",
    });
  } catch (error) {
    console.error("Error editing leave request:", error);
    return NextResponse.json(
      { error: "Failed to edit leave request" },
      { status: 500 }
    );
  }
}