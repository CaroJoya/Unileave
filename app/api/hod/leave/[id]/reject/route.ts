// app/api/hod/leave/[id]/reject/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { sendEmail, getLeaveRejectedEmail } from "@/lib/utils/email";

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
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
}

interface LeaveBalanceDoc {
  balances: {
    [key: string]: {
      pending: number;
      available: number;
    };
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

    // ✅ ALWAYS restore balance
    const academicYear = getCurrentAcademicYear();
    const balanceKey = `${leaveRequest.applicantId}_${academicYear}`;
    const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
    const balanceSnapshot = await balanceRef.once("value");
    const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;
    
    if (balanceDoc && balanceDoc.balances[leaveRequest.leaveType]) {
      const currentPending = balanceDoc.balances[leaveRequest.leaveType].pending || 0;
      const currentAvailable = balanceDoc.balances[leaveRequest.leaveType].available || 0;
      
      await balanceRef.update({
        [`balances.${leaveRequest.leaveType}.pending`]: Math.max(0, currentPending - leaveRequest.totalDays),
        [`balances.${leaveRequest.leaveType}.available`]: currentAvailable + leaveRequest.totalDays,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`✅ Balance restored for user ${leaveRequest.applicantId}, leave type ${leaveRequest.leaveType}`);
    } else {
      console.warn(`⚠️ Balance not found for user ${leaveRequest.applicantId}, leave type ${leaveRequest.leaveType}`);
    }

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Rejected_HOD",
      balanceRestored: true,
      updatedAt: new Date().toISOString(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: hodId,
      actionByName: hodData.name,
      actionRole: "hod",
      action: "REJECT",
      remark: reason,
      oldStatus: "Pending_HOD",
      newStatus: "Rejected_HOD",
      actionAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Leave Request Rejected",
      message: `Your ${leaveRequest.leaveType} leave request has been rejected by HOD. Reason: ${reason}`,
      type: "leave_rejected",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const applicantSnapshot = await rtdb.ref(`users/${leaveRequest.applicantId}`).once("value");
    const applicantData = applicantSnapshot.val() as User | null;

    if (applicantData?.email) {
      const emailHtml = getLeaveRejectedEmail(
        leaveRequest.applicantName,
        leaveRequest.leaveType,
        leaveRequest.startDate,
        leaveRequest.endDate,
        reason,
        hodData.name
      );
      
      sendEmail(
        applicantData.email,
        `Leave Request Rejected - ${leaveRequest.leaveType}`,
        emailHtml
      ).catch(err => console.error("❌ Failed to send rejection email:", err));
    }

    return NextResponse.json({ 
      success: true,
      balanceRestored: true 
    });
  } catch (error) {
    console.error("Error rejecting leave request:", error);
    return NextResponse.json({ error: "Failed to reject leave request" }, { status: 500 });
  }
}