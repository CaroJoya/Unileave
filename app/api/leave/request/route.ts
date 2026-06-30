// app/api/leave/request/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import { sendEmail, getLeaveSubmittedEmail } from "@/lib/utils/email";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/types/leave";
import type { Role } from "@/types/roles";

interface LeaveTypeData {
  leaveCode: string;
  isActive: boolean;
  deductsBalance: boolean;
  requiresAttachment: boolean;
  allowHalfDay: boolean;
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

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface LeaveBalancesDoc {
  userId: string;
  academicYear: string;
  balances: Record<string, LeaveBalance>;
  updatedAt: string;
}

interface ExistingLeaveRequest {
  applicantId: string;
  status: string;
  startDate: string;
  endDate: string;
}

const DEFAULT_QUOTAS: Record<string, Record<string, number>> = {
  faculty: { CL: 24, EL: 12, ML: 15, CO: 10 },
  lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8 },
  office_staff: { CL: 20, EL: 10, ML: 15, CO: 8 },
  hod: { CL: 24, EL: 15, ML: 15, CO: 10 },
  registrar: { CL: 20, EL: 12, ML: 15, CO: 10 },
  principal: { CL: 30, EL: 20, ML: 15, CO: 12 },
  head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10 },
};

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

async function getRoleQuotas(role: string, academicYear: string): Promise<Record<string, number>> {
  const rtdb = getRTDB();
  if (!rtdb) return DEFAULT_QUOTAS.faculty;

  try {
    const policySnapshot = await rtdb.ref(`leavePolicies/${academicYear}`).once("value");
    const policy = policySnapshot.val();
    
    if (policy && policy.leaveAllocations) {
      const roleKey = role === "lab_assistant" ? "lab_assistant" : 
                      role === "office_staff" ? "office_staff" : role;
      const allocation = policy.leaveAllocations[roleKey];
      if (allocation) {
        return {
          CL: allocation.CL || 0,
          EL: allocation.EL || 0,
          ML: allocation.ML || 0,
          CO: allocation.CO || 0,
        };
      }
    }
  } catch (error) {
    console.error("Error fetching policy:", error);
  }
  
  const roleKey = role === "lab_assistant" ? "lab_assistant" : 
                  role === "office_staff" ? "office_staff" : role;
  return DEFAULT_QUOTAS[roleKey] || DEFAULT_QUOTAS.faculty;
}

async function initializeBalance(
  userId: string, 
  userRole: string, 
  academicYear: string
): Promise<LeaveBalancesDoc> {
  const rtdb = getRTDB();
  if (!rtdb) throw new Error("Database not initialized");

  const quotas = await getRoleQuotas(userRole, academicYear);
  
  const balances: Record<string, LeaveBalance> = {
    CL: { allocated: quotas.CL || 0, used: 0, pending: 0, available: quotas.CL || 0 },
    EL: { allocated: quotas.EL || 0, used: 0, pending: 0, available: quotas.EL || 0 },
    ML: { allocated: quotas.ML || 0, used: 0, pending: 0, available: quotas.ML || 0 },
    CO: { allocated: quotas.CO || 0, used: 0, pending: 0, available: quotas.CO || 0 },
  };
  
  const balanceDoc: LeaveBalancesDoc = {
    userId,
    academicYear,
    balances,
    updatedAt: new Date().toISOString(),
  };
  
  await rtdb.ref(`leaveBalances/${userId}_${academicYear}`).set(balanceDoc);
  return balanceDoc;
}

async function getOrCreateBalance(
  userId: string,
  userRole: string,
  academicYear: string
): Promise<LeaveBalancesDoc> {
  const rtdb = getRTDB();
  if (!rtdb) throw new Error("Database not initialized");

  const balanceKey = `${userId}_${academicYear}`;
  const balanceSnapshot = await rtdb.ref(`leaveBalances/${balanceKey}`).once("value");
  const existingBalance = balanceSnapshot.val() as LeaveBalancesDoc | null;

  if (existingBalance) {
    return existingBalance;
  }

  return await initializeBalance(userId, userRole, academicYear);
}

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
    } = body;

    if (!leaveType) {
      console.error("❌ Missing leaveType");
      return NextResponse.json(
        { error: "Leave type is required", field: "leaveType" },
        { status: 400 }
      );
    }

    if (!startDate) {
      console.error("❌ Missing startDate");
      return NextResponse.json(
        { error: "Start date is required", field: "startDate" },
        { status: 400 }
      );
    }

    if (!totalDays || totalDays <= 0) {
      console.error("❌ Invalid totalDays:", totalDays);
      return NextResponse.json(
        { error: "Total days must be greater than 0", field: "totalDays" },
        { status: 400 }
      );
    }

    if (!alternateFacultyName || alternateFacultyName.trim() === "") {
      console.error("❌ Missing alternateFacultyName");
      return NextResponse.json(
        { error: "Alternate faculty name is required", field: "alternateFacultyName" },
        { status: 400 }
      );
    }

    if (alternateFacultyName.trim().length < 3) {
      console.error("❌ alternateFacultyName too short:", alternateFacultyName);
      return NextResponse.json(
        { error: "Alternate faculty name must be at least 3 characters", field: "alternateFacultyName" },
        { status: 400 }
      );
    }

    const leaveTypeConfig = await getLeaveTypeConfig(leaveType);
    if (!leaveTypeConfig) {
      console.error("❌ Invalid leave type:", leaveType);
      return NextResponse.json(
        { error: "Invalid leave type", field: "leaveType" },
        { status: 400 }
      );
    }

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

    if (leaveTypeConfig.requiresAttachment && !attachmentUrl) {
      return NextResponse.json(
        { error: "Attachment is required for this leave type", field: "attachmentUrl" },
        { status: 400 }
      );
    }

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
      console.error("❌ Overlapping leave request detected");
      return NextResponse.json(
        { error: "You have an overlapping leave request", field: "overlap" },
        { status: 400 }
      );
    }

    const academicYear = getCurrentAcademicYear();
    let balanceDoc: LeaveBalancesDoc;
    
    try {
      const userRole = userData.roles?.[0] || "faculty";
      balanceDoc = await getOrCreateBalance(userId, userRole, academicYear);
      console.log(`✅ Balance ${balanceDoc.balances ? 'exists' : 'created'} for user ${userId}`);
    } catch (balanceError) {
      console.error("❌ Error getting/creating balance:", balanceError);
      return NextResponse.json(
        { error: "Failed to initialize leave balance. Please contact admin.", field: "balance" },
        { status: 500 }
      );
    }

    if (leaveTypeConfig.deductsBalance) {
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

    const userRoles = userData.roles as Role[];
    const route = determineApprover(userRoles, leaveType);
    const approverRole = route.firstApproverRole;
    const approverUserId = await getApproverUserId(
      approverRole,
      userData.collegeId,
      userData.departmentId
    );

    if (!approverUserId) {
      console.error(`❌ No ${approverRole} found for college ${userData.collegeId}`);
      return NextResponse.json(
        { error: `No ${approverRole} found to approve this request`, field: "approver" },
        { status: 400 }
      );
    }

    const status = getStatusForApprover(approverRole) as LeaveStatus;
    const requestId = `leave_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    if (leaveTypeConfig.deductsBalance) {
      const currentBalance = balanceDoc.balances[leaveType] || { pending: 0, available: 0 };
      const updateData = {
        balances: {
          ...balanceDoc.balances,
          [leaveType]: {
            allocated: currentBalance.allocated || 0,
            used: currentBalance.used || 0,
            pending: (currentBalance.pending || 0) + totalDays,
            available: (currentBalance.available || 0) - totalDays,
          }
        },
        updatedAt: new Date().toISOString(),
      };
      
      await rtdb.ref(`leaveBalances/${userId}_${academicYear}`).update(updateData);
      console.log(`✅ Balance updated for user ${userId}, leave type ${leaveType}`);
    }

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
    };

    await rtdb.ref(`leaveRequests/${requestId}`).set(leaveRequest);
    console.log(`✅ Leave request created: ${requestId}`);

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
      
      const emailSent = await sendEmail(
        approverData.email,
        `New Leave Request: ${leaveType} from ${userData.name}`,
        emailHtml
      );
      
      if (emailSent) {
        console.log(`✅ Email sent to approver: ${approverData.email}`);
      } else {
        console.log(`⚠️ Email not sent to approver: ${approverData.email} (SMTP not configured)`);
      }
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