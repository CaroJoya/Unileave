// app/api/registrar/leave/[id]/remark/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail } from "@/lib/utils/email";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  departmentId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  revisionCount: number;
  status: string;
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

    const body = await request.json();
    const { remarks } = body;

    if (!remarks || remarks.trim() === "") {
      return NextResponse.json({ error: "Remarks are required" }, { status: 400 });
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

    const newRevisionCount = (leaveRequest.revisionCount || 0) + 1;

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Pending_Revision",
      revisionCount: newRevisionCount,
      updatedAt: new Date().toISOString(),
    });

    const revisionId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`revisionHistory/${revisionId}`).set({
      id: revisionId,
      leaveRequestId: id,
      cycleNumber: newRevisionCount,
      remarkSentBy: registrarId,
      remarkSentByName: registrarData.name,
      remarkText: remarks,
      remarkSentAt: new Date().toISOString(),
      resubmittedBy: null,
      resubmittedAt: null,
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: registrarId,
      actionByName: registrarData.name,
      actionRole: "registrar",
      action: "SEND_REMARKS",
      remark: remarks,
      oldStatus: "Pending_Registrar",
      newStatus: "Pending_Revision",
      actionAt: new Date().toISOString(),
    });

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: registrarId,
      userName: registrarData.name,
      userRole: "registrar",
      action: "LEAVE_REMARKS_SENT",
      module: "leaveRequests",
      targetId: id,
      targetType: "leaveRequest",
      targetUser: leaveRequest.applicantId,
      details: {
        leaveType: leaveRequest.leaveType,
        revisionCount: newRevisionCount,
      },
      createdAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Leave Request Needs Revision",
      message: `Your ${leaveRequest.leaveType} leave request needs revision. Please check the remarks.`,
      type: "leave_revision",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
      await sendEmail({
        to: applicantData.email,
        subject: `Leave Request Needs Revision - ${leaveRequest.leaveType}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #F59E0B;">Revision Required</h2>
            <p>Dear ${leaveRequest.applicantName},</p>
            <p>Your ${leaveRequest.leaveType} leave request requires revision. The Registrar has sent the following remarks:</p>
            <div style="background-color: #FEF3C7; padding: 12px; border-radius: 6px; margin: 16px 0;">
              <em>${remarks}</em>
            </div>
            <a href="${statusPageUrl}" style="display: inline-block; background-color: #6366F1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View & Edit Request</a>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending remarks:", error);
    return NextResponse.json({ error: "Failed to send remarks" }, { status: 500 });
  }
}