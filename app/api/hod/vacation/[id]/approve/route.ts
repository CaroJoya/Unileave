// app/api/hod/vacation/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getVacationApprovedEmail } from "@/lib/utils/email";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  departmentId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  vacationDetails?: {
    paidDays: number;
    unpaidDays: number;
    vacationType: string;
  };
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val();

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized - HOD only" }, { status: 403 });
    }

    // Get leave request
    const requestSnapshot = await rtdb.ref(`leaveRequests/${id}`).once("value");
    const leaveRequest = requestSnapshot.val() as LeaveRequest | null;

    if (!leaveRequest) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    // Verify it's a vacation request
    if (leaveRequest.leaveType !== "VL") {
      return NextResponse.json({ error: "Not a vacation request" }, { status: 400 });
    }

    // Verify department
    if (leaveRequest.departmentId !== hodData.departmentId) {
      return NextResponse.json({ error: "Not authorized for this department" }, { status: 403 });
    }

    // Verify status
    if (leaveRequest.status !== "Pending_HOD") {
      return NextResponse.json({ error: "Request is not pending HOD approval" }, { status: 400 });
    }

    // Update leave request
    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Approved",
      approvedBy: "hod",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create approval log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: hodId,
      actionByName: hodData.name,
      actionRole: "hod",
      action: "APPROVE_VACATION",
      remark: null,
      oldStatus: "Pending_HOD",
      newStatus: "Approved",
      actionAt: new Date().toISOString(),
    });

    // Create notification
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const paidMsg = leaveRequest.vacationDetails 
      ? ` (Paid: ${leaveRequest.vacationDetails.paidDays} days, Unpaid: ${leaveRequest.vacationDetails.unpaidDays} days)`
      : "";
    
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Vacation Request Approved",
      message: `Your vacation request has been approved by HOD.${paidMsg}`,
      type: "vacation_approved",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    // Send email
    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val();

    if (applicantData?.email) {
      const statusPageUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/status`;
      await sendEmail({
        to: applicantData.email,
        subject: "Vacation Request Approved",
        html: getVacationApprovedEmail(
          leaveRequest.applicantName,
          leaveRequest.startDate,
          leaveRequest.endDate,
          leaveRequest.totalDays,
          leaveRequest.vacationDetails?.paidDays || 0,
          leaveRequest.vacationDetails?.unpaidDays || 0,
          statusPageUrl
        ),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving vacation request:", error);
    return NextResponse.json({ error: "Failed to approve vacation request" }, { status: 500 });
  }
}