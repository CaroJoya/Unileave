// app/api/principal/direct-approvals/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantRoles: string[];
  departmentId: string;
  departmentName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  alternateFacultyName: string;
  attachmentUrl: string | null;
  status: string;
  createdAt: string;
}

interface ApprovalLog {
  id: string;
  leaveRequestId: string;
  actionByName: string;
  actionRole: string;
  action: string;
  remark: string | null;
  oldStatus: string | null;
  newStatus: string;
  actionAt: string;
}

interface User {
  uid: string;
  name: string;
  roles: string[];
  collegeId: string;
}

export async function GET() {
  try {
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

    const collegeId = principalData.collegeId;

    // Get all users in college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);

    // Get leave requests pending principal approval
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allLeaveRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const pendingRequests = Object.values(allLeaveRequests)
      .filter(req => 
        collegeUserIds.includes(req.applicantId) && 
        req.status === "Pending_Principal"
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Get approval logs for each request
    const logsSnapshot = await rtdb.ref("approvalLogs").once("value");
    const allLogs = logsSnapshot.val() as Record<string, ApprovalLog> | null || {};

    const requestsWithLogs = pendingRequests.map(req => ({
      ...req,
      approvalLogs: Object.values(allLogs)
        .filter(log => log.leaveRequestId === req.id)
        .sort((a, b) => new Date(a.actionAt).getTime() - new Date(b.actionAt).getTime()),
    }));

    return NextResponse.json({ requests: requestsWithLogs });
  } catch (error) {
    console.error("Error fetching direct approvals:", error);
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }
}