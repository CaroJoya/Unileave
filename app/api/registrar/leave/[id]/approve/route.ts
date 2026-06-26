// app/api/registrar/leave/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getLeaveApprovedEmail } from "@/lib/utils/email";

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
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    if (leaveRequest.status !== "Pending_Registrar") {
      return NextResponse.json({ error: "Request is not pending registrar approval" }, { status: 400 });
    }

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Approved",
      approvedBy: "registrar",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: registrarId,
      actionByName: registrarData.name,
      actionRole: "registrar",
      action: "APPROVE",
      remark: null,
      oldStatus: "Pending_Registrar",
      newStatus: "Approved",
      actionAt: new Date().toISOString(),
    });

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: registrarId,
      userName: registrarData.name,
      userRole: "registrar",
      action: "LEAVE_APPROVED",
      module: "leaveRequests",
      targetId: id,
      targetType: "leaveRequest",
      targetUser: leaveRequest.applicantId,
      details: {
        leaveType: leaveRequest.leaveType,
        totalDays: leaveRequest.totalDays,
      },
      createdAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Leave Request Approved",
      message: `Your ${leaveRequest.leaveType} leave request has been approved by Registrar.`,
      type: "leave_approved",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    // ✅ SEND EMAIL TO APPLICANT (Office Staff) - FIXED
    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
      const emailHtml = getLeaveApprovedEmail(
        leaveRequest.applicantName,
        leaveRequest.leaveType,
        leaveRequest.startDate,
        leaveRequest.endDate,
        leaveRequest.totalDays,
        registrarData.name,
        statusPageUrl
      );
      
      // ✅ FIXED: sendEmail expects 3 args
      sendEmail(
        applicantData.email,
        `Leave Request Approved - ${leaveRequest.leaveType}`,
        emailHtml
      ).catch(err => console.error("❌ Failed to send approval email:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving leave request:", error);
    return NextResponse.json({ error: "Failed to approve leave request" }, { status: 500 });
  }
}