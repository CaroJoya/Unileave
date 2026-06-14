// app/api/hod/dashboard/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface LeaveRequest {
  id: string;
  status: string;
  departmentId: string;
  applicantRoles: string[];
  leaveType: string;
}

interface CompOffCredit {
  id: string;
  userId: string;
  status: string;
  usedDays: number;
  creditedDays: number;
}

interface OverworkEntry {
  id: string;
  status: string;
  departmentId: string;
  userId: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  status: string;
  isEmployed: boolean;
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
    const hodId = decodedToken.uid;

    // Get HOD user data
    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as User | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized - HOD only" }, { status: 403 });
    }

    const departmentId = hodData.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: "HOD not assigned to any department" }, { status: 400 });
    }

    // Get all leave requests
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allLeaveRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Filter leave requests for HOD's department with Pending_HOD status
    const pendingLeaveRequests = Object.values(allLeaveRequests).filter(req => 
      req.departmentId === departmentId && 
      req.status === "Pending_HOD" &&
      (req.applicantRoles?.includes("faculty") || req.applicantRoles?.includes("lab_assistant"))
    );

    // Get comp-off credits pending approval
    const compOffSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCompOff = compOffSnapshot.val() as Record<string, CompOffCredit> | null || {};

    // Get users in department to filter comp-off requests
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    const departmentUserIds = Object.entries(allUsers)
      .filter(([, user]) => 
        user.departmentId === departmentId && 
        (user.roles?.includes("faculty") || user.roles?.includes("lab_assistant")) &&
        user.status === "active"
      )
      .map(([uid]) => uid);

    const pendingCompOff = Object.values(allCompOff).filter(credit => 
      departmentUserIds.includes(credit.userId) && 
      credit.status === "pending_approval"
    );

    // Get overwork entries pending approval
    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allOverwork = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};

    const pendingOverwork = Object.values(allOverwork).filter(entry => 
      entry.departmentId === departmentId && 
      entry.status === "pending" &&
      departmentUserIds.includes(entry.userId)
    );

    // Get vacation requests (leave requests with leaveType = "VL")
    const pendingVacation = Object.values(allLeaveRequests).filter(req => 
      req.departmentId === departmentId && 
      req.status === "Pending_HOD" &&
      req.leaveType === "VL"
    );

    // Count faculty in department
    const facultyCount = departmentUserIds.length;

    return NextResponse.json({
      pendingLeaves: pendingLeaveRequests.length,
      pendingCompOff: pendingCompOff.length,
      pendingOverwork: pendingOverwork.length,
      pendingVacation: pendingVacation.length,
      facultyCount,
    });
  } catch (error) {
    console.error("Error fetching HOD dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}