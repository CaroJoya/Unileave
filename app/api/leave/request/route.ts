// app/api/leave/request/route.ts - COMPLETE UPDATED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import { sendEmail, getLeaveSubmittedEmail } from "@/lib/utils/email";
import { getOrCreateLeaveBalance, deductLeaveBalance } from "@/lib/services/leave-balance-service";
import { validateODDetails } from "@/lib/services/od-service";
import { getAvailableCompOffCredits } from "@/lib/services/comp-off-service";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/types/leave";
import type { Role } from "@/types/roles";

// ============ TYPES ============

interface LeaveTypeData {
  leaveCode: string;
  isActive: boolean;
  deductsBalance: boolean;
  requiresAttachment: boolean;
  allowHalfDay: boolean;
  requiresEventDetails: boolean;
}

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

interface ExistingLeaveRequest {
  applicantId: string;
  status: string;
  startDate: string;
  endDate: string;
}

// ============ HELPER FUNCTIONS ============

async function getLeaveTypeConfig(leaveCode: string): Promise<LeaveTypeData | null> {
  const rtdb = getRTDB();
  if (!rtdb) return null;
  
  const typesSnapshot = await rtdb.ref("leaveTypes").once("value");
  const types = typesSnapshot.val() as Record<string, LeaveTypeData> | null || {};

  for (const [, type] of Object.entries(types)) {
    if (type.leaveCode === leaveCode && type.isActive) {
      return {
        leaveCode: type.leaveCode,
        isActive: type.isActive,
        deductsBalance: type.deductsBalance !== false,
        requiresAttachment: type.requiresAttachment || false,
        allowHalfDay: type.allowHalfDay || false,
        requiresEventDetails: type.requiresEventDetails || false,
      };
    }
  }
  return null;
}

async function getApproverUserId(
  role: "hod" | "registrar" | "principal",
  collegeId: string,
  departmentId?: string
): Promise<string | null> {
  const rtdb = getRTDB();
  if (!rtdb) return null;
  
  if (role === "hod" && departmentId) {
    const deptSnapshot = await rtdb.ref(`departments/${departmentId}`).once("value");
    const dept = deptSnapshot.val() as DepartmentData | null;
    return dept?.hodId || null;
  }

  if (role === "registrar") {
    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, RegistrarUserData> | null || {};
    for (const [uid, user] of Object.entries(users)) {
      if (user.roles?.includes("registrar") && user.collegeId === collegeId) {
        return uid;
      }
    }
    return null;
  }

  if (role === "principal") {
    const collegeSnapshot = await rtdb.ref(`colleges/${collegeId}`).once("value");
    const college = collegeSnapshot.val() as CollegeData | null;
    return college?.principalId || null;
  }

  return null;
}

// ============ MAIN HANDLER ============

export async function POST(request: Request) {
  try {
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

    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = userSnapshot.val() as UserData | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userData.roles?.includes("principal")) {
      return NextResponse.json(
        { error: "Principal cannot request leave" },
        { status: 403 }
      );
    }

    const body = await request.json();
    console.log("📝 Leave Request Body:", JSON.stringify(body, null, 2));

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
      odDetails, // ✅ NEW: OD specific details
    } = body;

    // ============ VALIDATION ============

    if (!leaveType) {
      return NextResponse.json(
        { error: "Leave type is required", field: "leaveType" },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: "Start date is required", field: "startDate" },
        { status: 400 }
      );
    }

    if (!totalDays || totalDays <= 0) {
      return NextResponse.json(
        { error: "Total days must be greater than 0", field: "totalDays" },
        { status: 400 }
      );
    }

    if (!alternateFacultyName || alternateFacultyName.trim() === "") {
      return NextResponse.json(
        { error: "Alternate faculty name is required", field: "alternateFacultyName" },
        { status: 400 }
      );
    }

    if (alternateFacultyName.trim().length < 3) {
      return NextResponse.json(
        { error: "Alternate faculty name must be at least 3 characters", field: "alternateFacultyName" },
        { status: 400 }
      );
    }

    const leaveTypeConfig = await getLeaveTypeConfig(leaveType);
    if (!leaveTypeConfig) {
      return NextResponse.json(
        { error: "Invalid leave type", field: "leaveType" },
        { status: 400 }
      );
    }

    // ✅ Check half-day
    if (isHalfDay && !leaveTypeConfig.allowHalfDay) {
      return NextResponse.json(
        { error: "Half-day leave is not allowed for this leave type", field: "isHalfDay" },
        { status: 400 }
      );
    }

    if (isHalfDay && !halfDaySession) {
      return NextResponse.json(
        { error: "Half-day session is required", field: "halfDaySession" },
        { status: 400 }
      );
    }

    // ✅ Check attachment
    if (leaveTypeConfig.requiresAttachment && !attachmentUrl) {
      return NextResponse.json(
        { error: "Attachment is required for this leave type", field: "attachmentUrl" },
        { status: 400 }
      );
    }

    // ✅ Check OD details
    if (leaveType === "OD" && leaveTypeConfig.requiresEventDetails) {
      if (!odDetails) {
        return NextResponse.json(
          { error: "Event details are required for On Duty leave", field: "odDetails" },
          { status: 400 }
        );
      }
      const validation = validateODDetails(odDetails);
      if (!validation.isValid) {
        return NextResponse.json(
          { error: validation.errors[0], field: "odDetails" },
          { status: 400 }
        );
      }
    }

    // ============ CHECK FOR OVERLAPPING REQUESTS ============

    const existingRequestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const existingRequests = existingRequestsSnapshot.val() as Record<string, ExistingLeaveRequest> | null || {};

    const hasOverlap = Object.values(existingRequests).some((req) => {
      if (req.applicantId !== userId) return false;
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
        { error: "You have an overlapping leave request", field: "overlap" },
        { status: 400 }
      );
    }

    const academicYear = getCurrentAcademicYear();
    const userRole = userData.roles?.[0] || "faculty";

    // ============ BALANCE CHECK ============

    if (leaveType === "CO") {
      // ✅ COMP-OFF: Check comp-off credits balance
      const availableCredits = await getAvailableCompOffCredits(userId);
      const totalAvailable = availableCredits.reduce((sum, c) => sum + (c.creditedDays - c.usedDays), 0);
      
      if (totalAvailable < totalDays) {
        return NextResponse.json(
          {
            error: `Insufficient comp-off balance. Available: ${totalAvailable}, Requested: ${totalDays}`,
            field: "balance",
          },
          { status: 400 }
        );
      }
    } else if (leaveTypeConfig.deductsBalance) {
      // ✅ REGULAR LEAVE: Check regular balance
      const balanceDoc = await getOrCreateLeaveBalance(userId, userRole, academicYear);
      if (!balanceDoc) {
        return NextResponse.json(
          { error: "Failed to get leave balance", field: "balance" },
          { status: 500 }
        );
      }
      const currentBalance = balanceDoc.balances[leaveType]?.available || 0;
      if (currentBalance < totalDays) {
        return NextResponse.json(
          {
            error: `Insufficient ${leaveType} balance. Available: ${currentBalance}, Requested: ${totalDays}`,
            field: "balance",
          },
          { status: 400 }
        );
      }
    }

    // ============ DETERMINE APPROVER ============

    const userRoles = userData.roles as Role[];
    const route = determineApprover(userRoles, leaveType);
    const approverRole = route.firstApproverRole;
    const approverUserId = await getApproverUserId(
      approverRole,
      userData.collegeId,
      userData.departmentId
    );

    if (!approverUserId) {
      return NextResponse.json(
        { error: `No ${approverRole} found to approve this request`, field: "approver" },
        { status: 400 }
      );
    }

    const status = getStatusForApprover(approverRole) as LeaveStatus;
    const requestId = `leave_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // ============ DEDUCT BALANCE (if applicable) ============

    if (leaveType !== "CO" && leaveTypeConfig.deductsBalance) {
      const deductResult = await deductLeaveBalance(userId, leaveType, totalDays, academicYear);
      if (!deductResult.success) {
        return NextResponse.json(
          { error: deductResult.error || "Failed to deduct leave balance", field: "balance" },
          { status: 400 }
        );
      }
    }

    // ============ CREATE LEAVE REQUEST ============

    const leaveRequest: LeaveRequest = {
      id: requestId,
      applicantId: userId,
      applicantName: userData.name,
      applicantRoles: userRoles,
      departmentId: userData.departmentId,
      departmentName: userData.departmentName,
      leaveType: leaveType as LeaveType,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate || startDate).toISOString(),
      totalDays,
      isHalfDay: isHalfDay || false,
      halfDaySession: halfDaySession || null,
      reason: reason || "",
      alternateFacultyName: alternateFacultyName.trim(),
      attachmentUrl: attachmentUrl || null,
      status,
      approvedBy: null,
      currentApproverId: approverUserId,
      revisionCount: 0,
      overriddenBy: null,
      overriddenAt: null,
      overrideReason: null,
      balanceRestored: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // ✅ NEW: OD details
      ...(leaveType === "OD" && odDetails && { odDetails }),
    };

    await rtdb.ref(`leaveRequests/${requestId}`).set(leaveRequest);
    console.log(`✅ Leave request created: ${requestId}`);

    // ============ LOG ACTION ============

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: requestId,
      actionBy: userId,
      actionByName: userData.name,
      actionRole: userRoles[0] || "staff",
      action: "SUBMIT",
      remark: null,
      oldStatus: null,
      newStatus: status,
      actionAt: new Date().toISOString(),
    });

    // ============ SEND NOTIFICATION ============

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: approverUserId,
      title: "New Leave Request",
      message: `${userData.name} has submitted a ${leaveType} leave request for ${totalDays} day(s).`,
      type: "leave_submitted",
      isRead: false,
      metadata: JSON.stringify({
        leaveRequestId: requestId,
        leaveType,
        totalDays,
        applicantId: userId,
      }),
      createdAt: new Date().toISOString(),
    });

    // ============ SEND EMAIL ============

    const approverSnapshot = await rtdb.ref(`users/${approverUserId}`).once("value");
    const approverData = approverSnapshot.val() as { email: string; name: string } | null;

    if (approverData?.email) {
      const emailHtml = getLeaveSubmittedEmail(
        userData.name,
        leaveType,
        startDate,
        endDate || startDate,
        reason || "No reason provided"
      );
      
      await sendEmail(
        approverData.email,
        `New Leave Request: ${leaveType} from ${userData.name}`,
        emailHtml
      ).catch(err => console.error("❌ Failed to send email:", err));
    }

    return NextResponse.json({
      success: true,
      requestId,
      status,
      currentApprover: approverRole,
    });
  } catch (error) {
    console.error("❌ Error submitting leave request:", error);
    return NextResponse.json(
      { error: "Failed to submit leave request" },
      { status: 500 }
    );
  }
}