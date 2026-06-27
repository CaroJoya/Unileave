// app/api/leave/request/[id]/edit/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import { sendEmail, getResubmittedEmail } from "@/lib/utils/email";
import type { LeaveRequest, LeaveStatus, LeaveType } from "@/types/leave";
import type { Role } from "@/types/roles";

// ============ TYPES ============

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
  leaveCode: string;
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

interface ExistingLeaveRequest {
  id?: string;
  applicantId: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface LeaveBalanceDoc {
  balances: {
    [key: string]: {
      allocated: number;
      used: number;
      pending: number;
      available: number;
    };
  };
}

interface EditRequestData {
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  isHalfDay?: boolean;
  halfDaySession?: "First Half" | "Second Half" | null;
  reason?: string;
  alternateFacultyName?: string;
  attachmentUrl?: string | null;
}

const EDITABLE_STATUSES: LeaveStatus[] = [
  "Pending_HOD",
  "Pending_Registrar", 
  "Pending_Principal",
  "Pending_Revision",
];

// ============ HELPER FUNCTIONS ============

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

async function getLeaveTypeConfig(leaveCode: string): Promise<LeaveTypeConfig | null> {
  const rtdb = getRTDB();
  if (!rtdb) return null;
  
  try {
    const typesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const types = typesSnapshot.val() as Record<string, LeaveTypeData> | null || {};

    for (const [, type] of Object.entries(types)) {
      if (type.leaveCode === leaveCode && type.isActive) {
        return {
          leaveCode: type.leaveCode,
          deductsBalance: type.deductsBalance !== false,
          requiresAttachment: type.requiresAttachment || false,
          allowHalfDay: type.allowHalfDay || false,
        };
      }
    }
  } catch (error) {
    console.error("Error fetching leave type config:", error);
  }
  return null;
}

function calculateTotalDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (isHalfDay) {
    return 0.5;
  }
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } catch (error) {
    console.error("Error calculating total days:", error);
    return 1;
  }
}

// ============ MAIN HANDLER ============

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

    // Get user data
    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = userSnapshot.val() as UserData | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get existing request
    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const existingRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!existingRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Authorization check
    if (existingRequest.applicantId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to edit this request" },
        { status: 403 }
      );
    }

    // Status check
    if (!EDITABLE_STATUSES.includes(existingRequest.status)) {
      return NextResponse.json(
        { error: "This request cannot be edited. It has already been approved or rejected." },
        { status: 400 }
      );
    }

    // Parse request body
    let body: EditRequestData;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    
    console.log("📝 Edit Request Body:", JSON.stringify(body, null, 2));

    // ============ VALIDATE AND MERGE CHANGES ============

    // 1. Leave Type - Validate if changed
    const finalLeaveType = body.leaveType || existingRequest.leaveType;
    const leaveTypeConfig = await getLeaveTypeConfig(finalLeaveType);
    
    if (!leaveTypeConfig) {
      return NextResponse.json(
        { error: `Invalid leave type: ${finalLeaveType}`, field: "leaveType" },
        { status: 400 }
      );
    }

    // 2. Half Day - Validate
    const finalIsHalfDay = body.isHalfDay !== undefined ? body.isHalfDay : existingRequest.isHalfDay;
    
    if (finalIsHalfDay && !leaveTypeConfig.allowHalfDay) {
      return NextResponse.json(
        { error: `Half-day leave is not allowed for ${finalLeaveType}`, field: "isHalfDay" },
        { status: 400 }
      );
    }

    // 3. Half Day Session - Validate
    const finalHalfDaySession = body.halfDaySession !== undefined 
      ? body.halfDaySession 
      : existingRequest.halfDaySession;
    
    if (finalIsHalfDay && !finalHalfDaySession) {
      return NextResponse.json(
        { error: "Half-day session is required", field: "halfDaySession" },
        { status: 400 }
      );
    }

    // 4. Dates - Validate
    const finalStartDate = body.startDate || existingRequest.startDate;
    let finalEndDate = body.endDate || existingRequest.endDate;

    // If half-day, end date must equal start date
    if (finalIsHalfDay) {
      finalEndDate = finalStartDate;
    }

    // Validate date range
    try {
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format", field: "dates" },
          { status: 400 }
        );
      }
      
      if (start > end) {
        return NextResponse.json(
          { error: "Start date cannot be after end date", field: "startDate" },
          { status: 400 }
        );
      }
    } catch (dateError) {
      console.error("Date validation error:", dateError);
      return NextResponse.json(
        { error: "Invalid date format", field: "dates" },
        { status: 400 }
      );
    }

    // 5. Total Days - Calculate if not provided
    let finalTotalDays = body.totalDays || 0;
    if (finalTotalDays <= 0) {
      finalTotalDays = calculateTotalDays(finalStartDate, finalEndDate, finalIsHalfDay);
    }

    // 6. Other fields
    const finalReason = body.reason !== undefined ? body.reason : existingRequest.reason;
    const finalAlternateFacultyName = body.alternateFacultyName !== undefined 
      ? body.alternateFacultyName 
      : existingRequest.alternateFacultyName;
    const finalAttachmentUrl = body.attachmentUrl !== undefined 
      ? body.attachmentUrl 
      : existingRequest.attachmentUrl;

    // Validate alternate faculty name
    if (finalAlternateFacultyName && finalAlternateFacultyName.trim().length < 3) {
      return NextResponse.json(
        { error: "Alternate faculty name must be at least 3 characters", field: "alternateFacultyName" },
        { status: 400 }
      );
    }

    // Validate attachment
    if (leaveTypeConfig.requiresAttachment && !finalAttachmentUrl) {
      return NextResponse.json(
        { error: "Attachment is required for this leave type", field: "attachmentUrl" },
        { status: 400 }
      );
    }

    // ============ CHECK FOR OVERLAPPING REQUESTS ============

    try {
      const existingRequestsSnapshot = await rtdb.ref("leaveRequests").once("value");
      const allRequests = existingRequestsSnapshot.val() as Record<string, ExistingLeaveRequest> | null || {};

      const hasOverlap = Object.values(allRequests).some((req) => {
        if (req.applicantId !== userId) return false;
        if (req.id === id) return false;
        if (
          req.status === "Cancelled" ||
          req.status === "Rejected_HOD" ||
          req.status === "Rejected_Registrar" ||
          req.status === "Rejected_Principal"
        ) {
          return false;
        }
        
        try {
          const reqStart = new Date(req.startDate);
          const reqEnd = new Date(req.endDate);
          const newStart = new Date(finalStartDate);
          const newEnd = new Date(finalEndDate);
          
          if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime()) || 
              isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
            return false;
          }
          
          return newStart <= reqEnd && newEnd >= reqStart;
        } catch (error) {
          console.error("Error checking overlap:", error);
          return false;
        }
      });

      if (hasOverlap) {
        return NextResponse.json(
          { error: "You have an overlapping leave request", field: "overlap" },
          { status: 400 }
        );
      }
    } catch (overlapError) {
      console.error("Error checking overlaps:", overlapError);
      // Continue - don't block the edit if overlap check fails
    }

    // ============ UPDATE LEAVE BALANCE ============

    let balanceUpdateSuccess = true;
    const leaveTypeChanged = body.leaveType && body.leaveType !== existingRequest.leaveType;
    const daysChanged = finalTotalDays !== existingRequest.totalDays;

    if ((leaveTypeChanged || daysChanged) && leaveTypeConfig.deductsBalance) {
      try {
        const academicYear = getCurrentAcademicYear();
        const balanceKey = `${userId}_${academicYear}`;
        const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
        const balanceSnapshot = await balanceRef.once("value");
        const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

        if (balanceDoc && balanceDoc.balances) {
          // Remove from old leave type's pending
          if (leaveTypeChanged && existingRequest.leaveType !== finalLeaveType) {
            const oldBalance = balanceDoc.balances[existingRequest.leaveType];
            if (oldBalance) {
              await balanceRef.update({
                [`balances.${existingRequest.leaveType}.pending`]: Math.max(0, (oldBalance.pending || 0) - existingRequest.totalDays),
                [`balances.${existingRequest.leaveType}.available`]: (oldBalance.available || 0) + existingRequest.totalDays,
              });
            }
            
            // Add to new leave type's pending
            const newBalance = balanceDoc.balances[finalLeaveType];
            if (newBalance) {
              // Check if enough available
              if (newBalance.available < finalTotalDays) {
                return NextResponse.json(
                  { error: `Insufficient ${finalLeaveType} balance. Available: ${newBalance.available}, Requested: ${finalTotalDays}`, field: "balance" },
                  { status: 400 }
                );
              }
              
              await balanceRef.update({
                [`balances.${finalLeaveType}.pending`]: (newBalance.pending || 0) + finalTotalDays,
                [`balances.${finalLeaveType}.available`]: (newBalance.available || 0) - finalTotalDays,
              });
            }
          } else if (daysChanged && !leaveTypeChanged) {
            // Same leave type, adjust the difference
            const currentBalance = balanceDoc.balances[finalLeaveType];
            if (currentBalance) {
              const dayDifference = finalTotalDays - existingRequest.totalDays;
              
              if (dayDifference > 0 && currentBalance.available < dayDifference) {
                return NextResponse.json(
                  { error: `Insufficient ${finalLeaveType} balance. Need ${dayDifference} more days. Available: ${currentBalance.available}`, field: "balance" },
                  { status: 400 }
                );
              }
              
              await balanceRef.update({
                [`balances.${finalLeaveType}.pending`]: (currentBalance.pending || 0) + dayDifference,
                [`balances.${finalLeaveType}.available`]: (currentBalance.available || 0) - dayDifference,
              });
            }
          }
        }
      } catch (balanceError) {
        console.error("❌ Balance update failed:", balanceError);
        balanceUpdateSuccess = false;
        // Continue with the edit, but log the error
      }
    }

    // ============ DETERMINE NEW STATUS ============

    let newStatus: LeaveStatus = existingRequest.status;
    let newRevisionCount = existingRequest.revisionCount || 0;

    // If resubmitting after revision
    if (existingRequest.status === "Pending_Revision") {
      try {
        const userRoles = existingRequest.applicantRoles as Role[];
        const route = determineApprover(userRoles, finalLeaveType);
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

        newStatus = getStatusForApprover(approverRole) as LeaveStatus;
        newRevisionCount = existingRequest.revisionCount + 1;

        await rtdb.ref(`leaveRequests/${id}`).update({
          currentApproverId: approverUserId,
        });

        // Record revision resubmission
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
      } catch (revisionError) {
        console.error("Error handling revision:", revisionError);
        // Continue with the edit
      }
    }

    // ============ UPDATE THE REQUEST ============

    try {
      const updateData: Partial<LeaveRequest> = {
        leaveType: finalLeaveType as LeaveType,
        startDate: new Date(finalStartDate).toISOString(),
        endDate: new Date(finalEndDate).toISOString(),
        totalDays: finalTotalDays,
        isHalfDay: finalIsHalfDay,
        halfDaySession: finalHalfDaySession,
        reason: finalReason || "",
        alternateFacultyName: finalAlternateFacultyName ? finalAlternateFacultyName.trim() : existingRequest.alternateFacultyName,
        attachmentUrl: finalAttachmentUrl,
        status: newStatus,
        revisionCount: newRevisionCount,
        updatedAt: new Date().toISOString(),
      };

      await rtdb.ref(`leaveRequests/${id}`).update(updateData);
    } catch (updateError) {
      console.error("❌ Failed to update request:", updateError);
      return NextResponse.json(
        { error: "Failed to update leave request" },
        { status: 500 }
      );
    }

    // ============ LOG THE ACTION ============

    try {
      const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`approvalLogs/${logId}`).set({
        id: logId,
        leaveRequestId: id,
        actionBy: userId,
        actionByName: userData.name,
        actionRole: existingRequest.applicantRoles[0] || "staff",
        action: existingRequest.status === "Pending_Revision" ? "RESUBMIT" : "EDIT",
        remark: JSON.stringify({
          oldLeaveType: existingRequest.leaveType,
          newLeaveType: finalLeaveType,
          oldTotalDays: existingRequest.totalDays,
          newTotalDays: finalTotalDays,
          oldIsHalfDay: existingRequest.isHalfDay,
          newIsHalfDay: finalIsHalfDay,
        }),
        oldStatus: existingRequest.status,
        newStatus,
        actionAt: new Date().toISOString(),
      });
    } catch (logError) {
      console.error("Error logging action:", logError);
      // Non-critical, continue
    }

    // ============ SEND EMAIL NOTIFICATIONS ============

    // If resubmitted after revision, notify approver
    if (existingRequest.status === "Pending_Revision") {
      try {
        const userRoles = existingRequest.applicantRoles as Role[];
        const route = determineApprover(userRoles, finalLeaveType);
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
            
            sendEmail(
              approverData.email,
              `Resubmitted: Leave Request from ${userData.name}`,
              emailHtml
            ).catch(err => console.error("❌ Failed to send resubmission email:", err));
          }
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Non-critical, continue
      }
    }

    // ============ RETURN RESPONSE ============

    return NextResponse.json({
      success: true,
      newStatus,
      totalDays: finalTotalDays,
      isHalfDay: finalIsHalfDay,
      balanceUpdated: balanceUpdateSuccess,
      message: existingRequest.status === "Pending_Revision"
        ? "Request resubmitted successfully"
        : "Request updated successfully",
    });
    
  } catch (error) {
    console.error("❌ Error editing leave request:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to edit leave request";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}