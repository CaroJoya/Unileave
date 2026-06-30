// app/api/principal/leave/[id]/approve/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getLeaveApprovedEmail } from "@/lib/utils/email";
import { createNotification } from "@/lib/services/notification-service";
import { createAuditLog } from "@/lib/services/audit-service";
import { NotificationType } from "@/lib/constants/notification-types";

// ✅ FIX: Define proper interface instead of using 'any'
interface CompOffUsageRecord {
  id: string;
  creditId: string;
  leaveRequestId: string;
  userId: string;
  daysUsed: number;
  status: "pending" | "approved" | "rejected";
  usedAt: string;
  updatedAt?: string;
}

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantRoles: string[];
  departmentId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  currentApproverId: string | null;
  revisionCount: number;
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
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId: string;
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

    if (leaveRequest.status !== "Pending_Principal") {
      return NextResponse.json({ error: "Request is not pending principal approval" }, { status: 400 });
    }

    // ============ UPDATE COMP-OFF CREDIT USAGE (if CO) ============
    
    if (leaveRequest.leaveType === "CO" && leaveRequest.compOffCreditsUsed) {
      const { creditId, daysUsed } = leaveRequest.compOffCreditsUsed;
      const creditRef = rtdb.ref(`compOffCredits/${creditId}`);
      const creditSnapshot = await creditRef.once('value');
      const credit = creditSnapshot.val() as CompOffCredit | null;
      
      if (credit) {
        const newUsedDays = (credit.usedDays || 0) + daysUsed;
        const isFullyUsed = newUsedDays >= credit.creditedDays;
        
        await creditRef.update({
          usedDays: newUsedDays,
          status: isFullyUsed ? 'fully_used' : 'active',
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`✅ Comp-off credit ${creditId} updated: usedDays=${newUsedDays}, status=${isFullyUsed ? 'fully_used' : 'active'}`);
        
        // ✅ FIX: Use proper interface instead of 'any'
        const usageSnapshot = await rtdb.ref('compOffUsage').once('value');
        const allUsage = usageSnapshot.val() as Record<string, CompOffUsageRecord> | null | undefined;
        
        if (allUsage) {
          for (const [usageId, usage] of Object.entries(allUsage)) {
            if (usage.creditId === creditId && usage.leaveRequestId === id && usage.status === 'pending') {
              await rtdb.ref(`compOffUsage/${usageId}`).update({
                status: 'approved',
                updatedAt: new Date().toISOString(),
              });
              break;
            }
          }
        }
      }
    }

    // ============ UPDATE LEAVE REQUEST ============

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Approved",
      approvedBy: "principal",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // ============ LOG ACTION ============

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: principalId,
      actionByName: principalData.name,
      actionRole: "principal",
      action: "APPROVE",
      remark: null,
      oldStatus: "Pending_Principal",
      newStatus: "Approved",
      actionAt: new Date().toISOString(),
    });

    // ============ SEND NOTIFICATION ============

    await createNotification({
      userId: leaveRequest.applicantId,
      type: NotificationType.LEAVE_APPROVED,
      message: `Your ${leaveRequest.leaveType} leave request (${new Date(leaveRequest.startDate).toLocaleDateString()} - ${new Date(leaveRequest.endDate).toLocaleDateString()}) has been approved by Principal ${principalData.name}.`,
      metadata: {
        leaveRequestId: id,
        approver: "principal",
        approverName: principalData.name,
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
      },
    });

    // ============ AUDIT LOG ============

    await createAuditLog({
      userId: principalId,
      userName: principalData.name,
      userRole: "principal",
      action: "LEAVE_APPROVED",
      module: "leaveRequests",
      targetId: id,
      targetUser: leaveRequest.applicantId,
      details: {
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        compOffCreditUsed: leaveRequest.compOffCreditsUsed || null,
      },
    });

    // ============ SEND EMAIL ============

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      // ✅ FIX: getLeaveApprovedEmail expects 6 arguments, not 7
      const emailHtml = getLeaveApprovedEmail(
        leaveRequest.applicantName,
        leaveRequest.leaveType,
        leaveRequest.startDate,
        leaveRequest.endDate,
        leaveRequest.totalDays,
        principalData.name
        // ❌ REMOVED: statusPageUrl (extra argument)
      );
      
      await sendEmail(
        applicantData.email,
        `Leave Request Approved - ${leaveRequest.leaveType}`,
        emailHtml
      ).catch(err => console.error("❌ Failed to send approval email:", err));
    }

    return NextResponse.json({ 
      success: true,
      message: "Leave request approved successfully",
    });
  } catch (error) {
    console.error("Error approving leave request:", error);
    return NextResponse.json({ error: "Failed to approve leave request" }, { status: 500 });
  }
}