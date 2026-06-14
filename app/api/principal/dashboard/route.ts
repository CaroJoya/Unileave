// app/api/principal/dashboard/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface LeaveRequest {
  id: string;
  applicantId: string;
  departmentId: string;
  leaveType: string;
  status: string;
  startDate: string;
  approvedBy?: string;
  overriddenBy?: string | null;
  cancelledAt?: string | null;
}

interface OverworkEntry {
  id: string;
  userId: string;
  status: string;
}

interface CompOffCredit {
  id: string;
  userId: string;
  status: string;
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

    // Get leave requests
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allLeaveRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Pending Principal Approvals
    const pendingApprovals = Object.values(allLeaveRequests).filter(req => 
      collegeUserIds.includes(req.applicantId) && 
      req.status === "Pending_Principal"
    );

    // Override Eligible Requests (CL, EL, ML only)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const overrideEligible = Object.values(allLeaveRequests).filter(req => 
      collegeUserIds.includes(req.applicantId) &&
      ["CL", "EL", "ML"].includes(req.leaveType) &&
      req.status === "Approved" &&
      (req.approvedBy === "hod" || req.approvedBy === "registrar") &&
      req.overriddenBy === null &&
      req.cancelledAt === null &&
      new Date(req.startDate) > today
    );

    // Get overwork entries
    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allOverwork = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};

    const pendingOverwork = Object.values(allOverwork).filter(entry => 
      collegeUserIds.includes(entry.userId) && 
      entry.status === "pending"
    );

    // Get comp-off credits
    const compOffSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCompOff = compOffSnapshot.val() as Record<string, CompOffCredit> | null || {};

    const pendingCompOff = Object.values(allCompOff).filter(credit => 
      collegeUserIds.includes(credit.userId) && 
      credit.status === "pending_approval"
    );

    // Get vacation requests (Pending_Principal with leaveType VL)
    const pendingVacation = Object.values(allLeaveRequests).filter(req => 
      collegeUserIds.includes(req.applicantId) && 
      req.status === "Pending_Principal" &&
      req.leaveType === "VL"
    );

    return NextResponse.json({
      pendingApprovals: pendingApprovals.length,
      pendingOverwork: pendingOverwork.length,
      pendingCompOff: pendingCompOff.length,
      pendingVacation: pendingVacation.length,
      overrideEligible: overrideEligible.length,
    });
  } catch (error) {
    console.error("Error fetching principal dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}