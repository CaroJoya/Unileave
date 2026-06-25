// app/api/registrar/vacation/[id]/reject/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getVacationRejectedEmail } from "@/lib/utils/email";

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
    const { reason } = body;

    if (!reason || reason.trim() === "") {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val();

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val();

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Rejected_Registrar",
      updatedAt: new Date().toISOString(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: registrarId,
      actionByName: registrarData.name,
      actionRole: "registrar",
      action: "REJECT_VACATION",
      remark: reason,
      oldStatus: "Pending_Registrar",
      newStatus: "Rejected_Registrar",
      actionAt: new Date().toISOString(),
    });

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: registrarId,
      userName: registrarData.name,
      userRole: "registrar",
      action: "VACATION_REJECTED",
      module: "leaveRequests",
      targetId: id,
      targetUser: leaveRequest.applicantId,
      details: {
        reason,
      },
      createdAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Vacation Request Rejected",
      message: `Your vacation request has been rejected by Registrar. Reason: ${reason}`,
      type: "vacation_rejected",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val();

    if (applicantData?.email) {
      await sendEmail({
        to: applicantData.email,
        subject: "Vacation Request Rejected",
        html: getVacationRejectedEmail(leaveRequest.applicantName, reason),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting vacation:", error);
    return NextResponse.json({ error: "Failed to reject vacation request" }, { status: 500 });
  }
}