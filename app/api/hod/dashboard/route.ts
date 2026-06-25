// app/api/hod/dashboard/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
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
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as User | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized - HOD only" }, { status: 403 });
    }

    const departmentId = hodData.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: "HOD not assigned to any department" }, { status: 400 });
    }

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allLeaveRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const pendingLeaveRequests = Object.values(allLeaveRequests).filter(req => 
      req.departmentId === departmentId && 
      req.status === "Pending_HOD" &&
      (req.applicantRoles?.includes("faculty") || req.applicantRoles?.includes("lab_assistant"))
    );

    const compOffSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCompOff = compOffSnapshot.val() as Record<string, CompOffCredit> | null || {};

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

    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allOverwork = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};

    const pendingOverwork = Object.values(allOverwork).filter(entry => 
      entry.departmentId === departmentId && 
      entry.status === "pending" &&
      departmentUserIds.includes(entry.userId)
    );

    const pendingVacation = Object.values(allLeaveRequests).filter(req => 
      req.departmentId === departmentId && 
      req.status === "Pending_HOD" &&
      req.leaveType === "VL"
    );

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