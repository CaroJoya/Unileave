// app/api/hod/leave/[id]/remarks/route.ts
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getRevisionEmail } from "@/lib/utils/email";

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
      remarkSentBy: hodId,
      remarkSentByName: hodData.name,
      remarkText: remarks,
      remarkSentAt: new Date().toISOString(),
      resubmittedBy: null,
      resubmittedAt: null,
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: hodId,
      actionByName: hodData.name,
      actionRole: "hod",
      action: "SEND_REMARKS",
      remark: remarks,
      oldStatus: "Pending_HOD",
      newStatus: "Pending_Revision",
      actionAt: new Date().toISOString(),
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

    // ✅ SEND REVISION EMAIL TO APPLICANT - FIXED
    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
      const emailHtml = getRevisionEmail(
        leaveRequest.applicantName,
        remarks,
        statusPageUrl
      );
      
      // ✅ FIXED: sendEmail expects 3 args
      sendEmail(
        applicantData.email,
        `Leave Request Needs Revision - ${leaveRequest.leaveType}`,
        emailHtml
      ).catch(err => console.error("❌ Failed to send revision email:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending remarks:", error);
    return NextResponse.json({ error: "Failed to send remarks" }, { status: 500 });
  }
}