// app/api/principal/vacation/[id]/approve/route.ts
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
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

    if (leaveRequest.leaveType !== "VL") {
      return NextResponse.json({ error: "Not a vacation request" }, { status: 400 });
    }

    if (leaveRequest.status !== "Pending_Principal") {
      return NextResponse.json({ error: "Request is not pending principal approval" }, { status: 400 });
    }

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Approved",
      approvedBy: "principal",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: principalId,
      actionByName: principalData.name,
      actionRole: "principal",
      action: "APPROVE_VACATION",
      remark: null,
      oldStatus: "Pending_Principal",
      newStatus: "Approved",
      actionAt: new Date().toISOString(),
    });

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: principalId,
      userName: principalData.name,
      userRole: "principal",
      action: "VACATION_APPROVED",
      module: "leaveRequests",
      targetId: id,
      targetUser: leaveRequest.applicantId,
      details: {
        totalDays: leaveRequest.totalDays,
        paidDays: leaveRequest.vacationDetails?.paidDays,
        unpaidDays: leaveRequest.vacationDetails?.unpaidDays,
      },
      createdAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const paidMsg = leaveRequest.vacationDetails 
      ? ` (Paid: ${leaveRequest.vacationDetails.paidDays} days, Unpaid: ${leaveRequest.vacationDetails.unpaidDays} days)`
      : "";
    
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Vacation Request Approved",
      message: `Your vacation request has been approved by Principal.${paidMsg}`,
      type: "vacation_approved",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

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