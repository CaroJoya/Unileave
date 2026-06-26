// app/api/registrar/dashboard/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
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
  updatedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  revisionCount: number;
  overriddenBy: string | null;
  overriddenAt: string | null;
  overrideReason: string | null;
  balanceRestored: boolean;
}

interface CompOffCredit {
  id: string;
  userId: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: string;
  createdAt: string;
}

interface OverworkEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  departmentId: string;
  hours: number;
  workDate: string;
  reason: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  collegeId: string;
  collegeName: string;
  status: string;
  isEmployed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
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
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const collegeId = registrarData.collegeId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    // ✅ FIXED: Get ALL users in college, not just office_staff and head_clerk
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId && user.status === "active")
      .map(([uid]) => uid);

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allLeaveRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const pendingLeaves = Object.values(allLeaveRequests).filter(req => 
      collegeUserIds.includes(req.applicantId) && 
      req.status === "Pending_Registrar"
    );

    const compOffSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCompOff = compOffSnapshot.val() as Record<string, CompOffCredit> | null || {};

    const pendingCompOff = Object.values(allCompOff).filter(credit => 
      collegeUserIds.includes(credit.userId) && 
      credit.status === "pending_approval"
    );

    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allOverwork = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};

    const pendingOverwork = Object.values(allOverwork).filter(entry => 
      collegeUserIds.includes(entry.userId) && 
      entry.status === "pending"
    );

    const pendingVacation = Object.values(allLeaveRequests).filter(req => 
      collegeUserIds.includes(req.applicantId) && 
      req.status === "Pending_Registrar" &&
      req.leaveType === "VL"
    );

    const staffCount = collegeUserIds.length;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let approvedThisMonth = 0;
    let rejectedThisMonth = 0;

    for (const req of Object.values(allLeaveRequests)) {
      if (collegeUserIds.includes(req.applicantId)) {
        const reqDate = new Date(req.createdAt);
        if (reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear) {
          if (req.status === "Approved") approvedThisMonth++;
          if (req.status.includes("Rejected")) rejectedThisMonth++;
        }
      }
    }

    return NextResponse.json({
      pendingLeaves: pendingLeaves.length,
      pendingCompOff: pendingCompOff.length,
      pendingOverwork: pendingOverwork.length,
      pendingVacation: pendingVacation.length,
      staffCount,
      approvedThisMonth,
      rejectedThisMonth,
    });
  } catch (error) {
    console.error("Error fetching registrar dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}