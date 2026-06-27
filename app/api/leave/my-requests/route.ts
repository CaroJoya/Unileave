// app/api/leave/my-requests/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import type { LeaveRequest, ApprovalLog, RevisionHistory } from "@/types/leave";

export async function GET(request: Request) {
  try {
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
    const userId = decodedToken.uid;

    const { searchParams } = new URL(request.url);
    const leaveType = searchParams.get("leaveType");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    console.log("📋 /api/leave/my-requests called by user:", userId);
    const requestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = requestsSnapshot.val() as Record<string, LeaveRequest> | null || {};
    console.log("📋 All requests:", allRequests);
    let userRequests = Object.values(allRequests).filter(
      (req) => req.applicantId === userId
    );
    console.log("📋 User requests:", userRequests);

    if (leaveType) {
      userRequests = userRequests.filter((req) => req.leaveType === leaveType);
    }
    if (status) {
      userRequests = userRequests.filter((req) => req.status === status);
    }
    if (startDate) {
      const start = new Date(startDate);
      userRequests = userRequests.filter((req) => new Date(req.startDate) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      userRequests = userRequests.filter((req) => new Date(req.endDate) <= end);
    }

    userRequests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const logsSnapshot = await rtdb.ref("approvalLogs").once("value");
    const allLogs = logsSnapshot.val() as Record<string, ApprovalLog> | null || {};

    const revisionsSnapshot = await rtdb.ref("revisionHistory").once("value");
    const allRevisions = revisionsSnapshot.val() as Record<string, RevisionHistory> | null || {};

    const requestsWithDetails = userRequests.map((req) => ({
      ...req,
      approvalLogs: Object.values(allLogs).filter((log) => log.leaveRequestId === req.id),
      revisionHistory: Object.values(allRevisions).filter(
        (rev) => rev.leaveRequestId === req.id
      ),
    }));

    return NextResponse.json({
      success: true,
      requests: requestsWithDetails,
    });
  } catch (error) {
    console.error("Error fetching leave requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave requests" },
      { status: 500 }
    );
  }
}