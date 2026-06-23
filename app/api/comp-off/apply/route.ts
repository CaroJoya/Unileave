// app/api/comp-off/apply/route.ts - Complete fixed version
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import type { LeaveRequest, LeaveStatus } from "@/types/leave";
import type { Role } from "@/types/roles";

// Extend LeaveRequest to include compOffCreditsUsed
interface ExtendedLeaveRequest extends LeaveRequest {
  compOffCreditsUsed?: {
    creditId: string;
    daysUsed: number;
  };
}

interface CompOffCredit {
  id: string;
  userId: string;
  creditedDays: number;
  usedDays: number;
  status: string;
  expiryDate: string;
  reason: string;
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

export async function POST(request: Request) {
  try {
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

    // Principal cannot request leave
    if (userData.roles?.includes("principal")) {
      return NextResponse.json(
        { error: "Principal cannot request leave" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      creditId,
      startDate,
      endDate,
      daysToUse,
      alternateFacultyName,
      reason,
    } = body;

    // Validation
    if (!creditId) {
      return NextResponse.json({ error: "Credit ID is required" }, { status: 400 });
    }

    if (!startDate) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 });
    }

    if (!daysToUse || daysToUse <= 0) {
      return NextResponse.json({ error: "Days to use must be greater than 0" }, { status: 400 });
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

    // Get the comp-off credit
    const creditSnapshot = await rtdb.ref(`compOffCredits/${creditId}`).once("value");
    const credit = creditSnapshot.val() as CompOffCredit | null;

    if (!credit) {
      return NextResponse.json({ error: "Comp-off credit not found" }, { status: 404 });
    }

    // Verify ownership
    if (credit.userId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to use this credit" },
        { status: 403 }
      );
    }

    // Check if credit is active
    if (credit.status !== "active") {
      return NextResponse.json(
        { error: `Credit is ${credit.status}. Cannot use.` },
        { status: 400 }
      );
    }

    // Check available days
    const availableDays = credit.creditedDays - credit.usedDays;
    if (availableDays < daysToUse) {
      return NextResponse.json(
        {
          error: `Insufficient credit. Available: ${availableDays}, Requested: ${daysToUse}`,
        },
        { status: 400 }
      );
    }

    // Check expiry
    const expiryDate = new Date(credit.expiryDate);
    const today = new Date();
    if (expiryDate < today) {
      return NextResponse.json(
        { error: "Credit has expired" },
        { status: 400 }
      );
    }

    // Determine approval routing
    const userRoles = userData.roles as Role[];
    const route = determineApprover(userRoles, "CO");
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

    const status = getStatusForApprover(approverRole) as LeaveStatus;
    const requestId = `leave_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Create leave request for comp-off using ExtendedLeaveRequest
    const leaveRequest: ExtendedLeaveRequest = {
      id: requestId,
      applicantId: userId,
      applicantName: userData.name,
      applicantRoles: userRoles,
      departmentId: userData.departmentId,
      departmentName: userData.departmentName,
      leaveType: "CO",
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate || startDate).toISOString(),
      totalDays: daysToUse,
      isHalfDay: false,
      halfDaySession: null,
      reason: reason || `Compensatory off for: ${credit.reason}`,
      alternateFacultyName: alternateFacultyName.trim(),
      attachmentUrl: null,
      status,
      approvedBy: null,
      currentApproverId: approverUserId,
      revisionCount: 0,
      overriddenBy: null,
      overriddenAt: null,
      overrideReason: null,
      balanceRestored: false,
      compOffCreditsUsed: {
        creditId: creditId,
        daysUsed: daysToUse,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in RTDB - use a type-safe approach without 'any'
    // Convert to a plain object that RTDB can handle
    const requestData = {
      ...leaveRequest,
      compOffCreditsUsed: leaveRequest.compOffCreditsUsed,
    };
    await rtdb.ref(`leaveRequests/${requestId}`).set(requestData);

    // Update the credit - mark as pending usage
    await rtdb.ref(`compOffCredits/${creditId}`).update({
      status: "pending_usage",
      pendingDays: daysToUse,
      updatedAt: new Date().toISOString(),
    });

    // Create comp-off usage record
    const usageId = `co_usage_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`compOffUsage/${usageId}`).set({
      id: usageId,
      creditId: creditId,
      leaveRequestId: requestId,
      userId: userId,
      userName: userData.name,
      daysUsed: daysToUse,
      usedAt: new Date().toISOString(),
      reason: reason || `Compensatory off for: ${credit.reason}`,
      status: "pending",
    });

    // Create approval log
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
      compOffCreditId: creditId,
    });

    // Create notification for approver
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: approverUserId,
      title: "New Comp-Off Request",
      message: `${userData.name} has requested to use ${daysToUse} comp-off day(s).`,
      type: "comp_off_submitted",
      isRead: false,
      metadata: JSON.stringify({
        leaveRequestId: requestId,
        creditId: creditId,
        daysToUse: daysToUse,
        applicantId: userId,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      requestId,
      status,
      currentApprover: approverRole,
      message: `Comp-off request submitted for ${daysToUse} day(s)`,
    });
  } catch (error) {
    console.error("Error applying comp-off:", error);
    return NextResponse.json(
      { error: "Failed to apply comp-off" },
      { status: 500 }
    );
  }
}