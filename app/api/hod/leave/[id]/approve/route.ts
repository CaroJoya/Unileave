// app/api/hod/leave/[id]/approve/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getLeaveApprovedEmail } from "@/lib/utils/email";
import { createNotification } from "@/lib/services/notification-service";
import { createAuditLog } from "@/lib/services/audit-service";
import { NotificationType } from "@/lib/constants/notification-types";

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
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  status: string;
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
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as User | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized - HOD only" }, { status: 403 });
    }

    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leaveRequest.departmentId !== hodData.departmentId) {
      return NextResponse.json({ error: "Not authorized for this department" }, { status: 403 });
    }

    if (leaveRequest.status !== "Pending_HOD") {
      return NextResponse.json({ error: "Request is not pending HOD approval" }, { status: 400 });
    }

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Approved",
      approvedBy: "hod",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: hodId,
      actionByName: hodData.name,
      actionRole: "hod",
      action: "APPROVE",
      remark: null,
      oldStatus: "Pending_HOD",
      newStatus: "Approved",
      actionAt: new Date().toISOString(),
    });

    await createNotification({
      userId: leaveRequest.applicantId,
      type: NotificationType.LEAVE_APPROVED,
      message: `Your ${leaveRequest.leaveType} leave request (${new Date(leaveRequest.startDate).toLocaleDateString()} - ${new Date(leaveRequest.endDate).toLocaleDateString()}) has been approved by HOD ${hodData.name}.`,
      metadata: {
        leaveRequestId: id,
        approver: "hod",
        approverName: hodData.name,
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
      },
    });

    await createAuditLog({
      userId: hodId,
      userName: hodData.name,
      userRole: "hod",
      action: "LEAVE_APPROVED",
      module: "leaveRequests",
      targetId: id,
      targetUser: leaveRequest.applicantId,
      details: {
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
      },
    });

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
      await sendEmail({
        to: applicantData.email,
        subject: `Leave Request Approved - ${leaveRequest.leaveType}`,
        html: getLeaveApprovedEmail(
          leaveRequest.applicantName,
          leaveRequest.leaveType,
          leaveRequest.startDate,
          leaveRequest.endDate,
          leaveRequest.totalDays,
          hodData.name,
          statusPageUrl
        ),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving leave request:", error);
    return NextResponse.json({ error: "Failed to approve leave request" }, { status: 500 });
  }
}