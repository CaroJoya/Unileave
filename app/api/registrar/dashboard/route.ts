// app/api/registrar/dashboard/route.ts
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const registrarId = decodedToken.uid;

    // Get registrar user data
    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const collegeId = registrarData.collegeId;

    // Get all office staff and head clerks in the college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    const staffUserIds = Object.entries(allUsers)
      .filter(([, user]) => 
        user.collegeId === collegeId && 
        (user.roles?.includes("office_staff") || user.roles?.includes("head_clerk")) &&
        user.status === "active"
      )
      .map(([uid]) => uid);

    // Get all leave requests
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allLeaveRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Get pending leave requests (Pending_Registrar status)
    const pendingLeaves = Object.values(allLeaveRequests).filter(req => 
      staffUserIds.includes(req.applicantId) && 
      req.status === "Pending_Registrar"
    );

    // Get pending comp-off credits
    const compOffSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCompOff = compOffSnapshot.val() as Record<string, CompOffCredit> | null || {};

    const pendingCompOff = Object.values(allCompOff).filter(credit => 
      staffUserIds.includes(credit.userId) && 
      credit.status === "pending_approval"
    );

    // Get pending overwork entries
    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allOverwork = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};

    const pendingOverwork = Object.values(allOverwork).filter(entry => 
      staffUserIds.includes(entry.userId) && 
      entry.status === "pending"
    );

    // Get pending vacation requests (leave requests with leaveType = "VL" and Pending_Registrar)
    const pendingVacation = Object.values(allLeaveRequests).filter(req => 
      staffUserIds.includes(req.applicantId) && 
      req.status === "Pending_Registrar" &&
      req.leaveType === "VL"
    );

    // Count office staff
    const officeStaffCount = staffUserIds.length;

    // Calculate approved and rejected this month
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let approvedThisMonth = 0;
    let rejectedThisMonth = 0;

    for (const req of Object.values(allLeaveRequests)) {
      if (staffUserIds.includes(req.applicantId)) {
        const reqDate = new Date(req.createdAt);
        if (reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear) {
          if (req.status === "Approved") approvedThisMonth++;
          if (req.status === "Rejected_Registrar" || req.status === "Rejected_HOD" || req.status === "Rejected_Principal") {
            rejectedThisMonth++;
          }
        }
      }
    }

    return NextResponse.json({
      pendingLeaves: pendingLeaves.length,
      pendingCompOff: pendingCompOff.length,
      pendingOverwork: pendingOverwork.length,
      pendingVacation: pendingVacation.length,
      officeStaffCount,
      approvedThisMonth,
      rejectedThisMonth,
    });
  } catch (error) {
    console.error("Error fetching registrar dashboard:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}