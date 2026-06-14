// app/api/principal/override-eligible/route.ts
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
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  overriddenBy?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
}

interface User {
  uid: string;
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

    // Get all leave requests
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allLeaveRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter override eligible requests
    const overrideEligible = Object.values(allLeaveRequests)
      .filter(req => 
        collegeUserIds.includes(req.applicantId) &&
        ["CL", "EL", "ML"].includes(req.leaveType) &&
        req.status === "Approved" &&
        (req.approvedBy === "hod" || req.approvedBy === "registrar") &&
        req.overriddenBy === null &&
        req.cancelledAt === null &&
        new Date(req.startDate) > today
      )
      .sort((a, b) => new Date(b.approvedAt || b.createdAt).getTime() - new Date(a.approvedAt || a.createdAt).getTime());

    return NextResponse.json({ requests: overrideEligible });
  } catch (error) {
    console.error("Error fetching override eligible requests:", error);
    return NextResponse.json({ error: "Failed to fetch override eligible requests" }, { status: 500 });
  }
}