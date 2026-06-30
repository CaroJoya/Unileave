// app/api/registrar/leave/[id]/reject/route.ts - COMPLETE FIXED FILE
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
    }

    await rtdb.ref(`leaveRequests/${id}`).update({
      status: "Rejected_Registrar",
      balanceRestored: true,
      updatedAt: new Date().toISOString(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      leaveRequestId: id,
      actionBy: registrarId,
      actionByName: registrarData.name,
      actionRole: "registrar",
      action: "REJECT",
      remark: reason,
      oldStatus: "Pending_Registrar",
      newStatus: "Rejected_Registrar",
      actionAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: leaveRequest.applicantId,
      title: "Leave Request Rejected",
      message: `Your ${leaveRequest.leaveType} leave request has been rejected by Registrar. Reason: ${reason}`,
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
        registrarData.name
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