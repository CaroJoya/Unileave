// app/api/leave/request/[id]/edit/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import { sendEmail, getResubmittedEmail } from "@/lib/utils/email";
import type { LeaveRequest, LeaveStatus } from "@/types/leave"; // ✅ Removed LeaveType
import type { Role } from "@/types/roles";

// Type definitions
interface UserData {
  name: string;
  roles: string[];
  collegeId: string;
  departmentId: string;
  departmentName: string;
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
  allowHalfDay: boolean;
}

interface LeaveTypeData {
  leaveCode: string;
  isActive: boolean;
  deductsBalance: boolean;
  requiresAttachment: boolean;
  allowHalfDay: boolean;
}

interface LeaveBalanceDoc {
  balances: {
    [key: string]: {
      pending: number;
      available: number;
    };
  };
}

// ✅ Added id to ExistingLeaveRequest
interface ExistingLeaveRequest {
  id?: string; // Optional since it might not exist on all requests
  applicantId: string;
  status: string;
  startDate: string;
  endDate: string;
}

// ✅ Only editable if NOT approved or rejected
const EDITABLE_STATUSES: LeaveStatus[] = [
  "Pending_HOD",
  "Pending_Registrar", 
  "Pending_Principal",
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
        allowHalfDay: type.allowHalfDay || false,
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

    // Get user data
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

    // ✅ Check if editable (not approved or rejected)
    if (!EDITABLE_STATUSES.includes(existingRequest.status)) {
      return NextResponse.json(
        { error: "This request cannot be edited. It has already been approved or rejected." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      leaveType,
      startDate,
      endDate,
      totalDays,
      isHalfDay,
      halfDaySession,
      reason,
      alternateFacultyName,
      attachmentUrl,
    } = body;

    // ✅ VALIDATION: Same as fresh leave request

    // Leave type is optional in edit (can't change leave type)
    // But if provided, validate it matches
    if (leaveType && leaveType !== existingRequest.leaveType) {
      return NextResponse.json(
        { error: "Leave type cannot be changed" },
        { status: 400 }
      );
    }

    // Use existing leave type
    const leaveTypeCode = existingRequest.leaveType;

    // Validate required fields
    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 });
    }

    // Validate total days
    if (!totalDays || totalDays <= 0) {
      return NextResponse.json({ error: "Total days must be greater than 0" }, { status: 400 });
    }

    // Validate alternate faculty name
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

    // Get leave type config for validation
    const leaveTypeConfig = await getLeaveTypeConfig(leaveTypeCode);
    if (!leaveTypeConfig) {
      return NextResponse.json({ error: "Invalid leave type" }, { status: 400 });
    }

    // ✅ Validate half-day
    if (isHalfDay && !leaveTypeConfig.allowHalfDay) {
      return NextResponse.json(
        { error: "Half-day leave is not allowed for this leave type" },
        { status: 400 }
      );
    }

    if (isHalfDay && !halfDaySession) {
      return NextResponse.json(
        { error: "Half-day session is required" },
        { status: 400 }
      );
    }

    // ✅ Validate attachment
    if (leaveTypeConfig.requiresAttachment && !attachmentUrl) {
      return NextResponse.json(
        { error: "Attachment is required for this leave type" },
        { status: 400 }
      );
    }

    // ✅ Check for overlapping leave requests (excluding the current request being edited)
    const existingRequestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const existingRequests = existingRequestsSnapshot?.val() as Record<string, ExistingLeaveRequest> | null || {};

    const hasOverlap = Object.values(existingRequests).some((req) => {
      // Skip the current request being edited
      if (req.applicantId !== userId) return false;
      // ✅ Use req.id to skip the current request (id is now defined in the interface)
      if (req.id === id) return false;
      if (
        req.status === "Cancelled" ||
        req.status === "Rejected_HOD" ||
        req.status === "Rejected_Registrar" ||
        req.status === "Rejected_Principal"
      ) {
        return false;
      }
      const reqStart = new Date(req.startDate);
      const reqEnd = new Date(req.endDate);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate || startDate);
      return newStart <= reqEnd && newEnd >= reqStart;
    });

    if (hasOverlap) {
      return NextResponse.json(
        { error: "You have an overlapping leave request" },
        { status: 400 }
      );
    }

    // ✅ Calculate the difference in days for balance adjustment
    const dayDifference = totalDays - existingRequest.totalDays;

    // ✅ Update balance if leave type deducts balance and there's a difference
    // AND the request hasn't been approved yet (balance hasn't been fully deducted)
    if (
      leaveTypeConfig.deductsBalance &&
      dayDifference !== 0 &&
      !existingRequest.balanceRestored
    ) {
      const academicYear = getCurrentAcademicYear();
      const balanceKey = `${userId}_${academicYear}`;
      const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
      const balanceSnapshot = await balanceRef.once("value");
      const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

      if (balanceDoc) {
        const currentAvailable = balanceDoc.balances[leaveTypeCode]?.available || 0;

        // If increasing days, check if enough balance available
        if (dayDifference > 0 && currentAvailable < dayDifference) {
          return NextResponse.json(
            { error: `Insufficient balance. Need ${dayDifference} more days` },
            { status: 400 }
          );
        }

        // Update balance using proper nested object
        const currentBalance = balanceDoc.balances[leaveTypeCode] || { pending: 0, available: 0 };
        const updateData = {
          balances: {
            ...balanceDoc.balances,
            [leaveTypeCode]: {
              pending: Math.max(0, (currentBalance.pending || 0) + dayDifference),
              available: (currentBalance.available || 0) - dayDifference,
            }
          },
          updatedAt: new Date().toISOString(),
        };
        
        await balanceRef.update(updateData);
      }
    }

    // ✅ Determine new status based on routing
    let newStatus: LeaveStatus = existingRequest.status;
    let newRevisionCount = existingRequest.revisionCount || 0;

    if (existingRequest.status === "Pending_Revision") {
      // Resubmit after remarks - go back to original approver
      const userRoles = existingRequest.applicantRoles as Role[];
      const route = determineApprover(userRoles, leaveTypeCode);
      const approverRole = route.firstApproverRole;
      const approverUserId = await getApproverUserId(
        approverRole,
        userData.collegeId,
        userData.departmentId
      );

      if (!approverUserId) {
        return NextResponse.json(
          { error: `No ${approverRole} found to approve this request` },
          { status: 400 }
        );
      }

      newStatus = getStatusForApprover(approverRole) as LeaveStatus;
      newRevisionCount = existingRequest.revisionCount + 1;

      // Update current approver
      await rtdb.ref(`leaveRequests/${id}`).update({
        currentApproverId: approverUserId,
      });

      // Create revision history entry
      const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`revisionHistory/${revisionId}`).set({
        id: revisionId,
        leaveRequestId: id,
        cycleNumber: newRevisionCount,
        remarkSentBy: existingRequest.currentApproverId,
        remarkSentByName: "",
        remarkText: "Resubmitted after revision",
        remarkSentAt: new Date().toISOString(),
        resubmittedBy: userId,
        resubmittedAt: new Date().toISOString(),
      });
    } else {
      // For Pending_HOD or Pending_Registrar - keep same status
      newStatus = existingRequest.status;
    }

    // ✅ Update leave request with ALL editable fields
    await rtdb.ref(`leaveRequests/${id}`).update({
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate || startDate).toISOString(),
      totalDays,
      isHalfDay: isHalfDay || false,
      halfDaySession: halfDaySession || null,
      reason: reason || "",
      alternateFacultyName: alternateFacultyName.trim(),
      attachmentUrl: attachmentUrl || null,
      status: newStatus,
      revisionCount: newRevisionCount,
      updatedAt: new Date().toISOString(),
    });

    // ✅ Create approval log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: userId,
      actionByName: userData.name,
      actionRole: existingRequest.applicantRoles[0] || "staff",
      action: existingRequest.status === "Pending_Revision" ? "RESUBMIT" : "EDIT",
      remark: null,
      oldStatus: existingRequest.status,
      newStatus,
      actionAt: new Date().toISOString(),
    });

    // ✅ Send email notification if resubmitting after revision
    if (existingRequest.status === "Pending_Revision") {
      const userRoles = existingRequest.applicantRoles as Role[];
      const route = determineApprover(userRoles, leaveTypeCode);
      const approverRole = route.firstApproverRole;
      const approverId = await getApproverUserId(
        approverRole,
        userData.collegeId,
        userData.departmentId
      );

      if (approverId) {
        const approverSnapshot = await rtdb.ref(`users/${approverId}`).once("value");
        const approverData = approverSnapshot.val() as { email: string } | null;

        if (approverData?.email) {
          const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
          const emailHtml = getResubmittedEmail(
            userData.name,
            statusPageUrl
          );
          await sendEmail({
            to: approverData.email,
            subject: `Resubmitted: Leave Request from ${userData.name}`,
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