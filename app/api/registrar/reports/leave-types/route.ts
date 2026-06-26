// app/api/registrar/reports/leave-types/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  departmentId: string;
  departmentName: string;
  leaveType: string;
  totalDays: number;
  status: string;
  createdAt: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  status: string;
  collegeId: string;
  collegeName: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
  CO: "Compensatory Off",
  VL: "Vacation Leave",
  OD: "On Duty",
};

const LEAVE_TYPE_COLORS: Record<string, string> = {
  CL: "#6366F1",
  EL: "#10B981",
  ML: "#F59E0B",
  CO: "#EF4444",
  VL: "#8B5CF6",
  OD: "#EC4899",
};

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
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get("academicYear") || getCurrentAcademicYear();
    const departmentId = searchParams.get("departmentId") || "";

    const collegeId = registrarData.collegeId;

    const [startYear, endYear] = academicYear.split("-").map(Number);
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31);

    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    // ✅ FIXED: Get ALL users in college
    let collegeUsers = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid, user]) => ({ ...user, uid }));

    if (departmentId) {
      collegeUsers = collegeUsers.filter(user => user.departmentId === departmentId);
    }

    const userIds = collegeUsers.map(u => u.uid);

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const filteredRequests = Object.values(allRequests).filter(req => {
      const reqDate = new Date(req.createdAt);
      return userIds.includes(req.applicantId) && 
             reqDate >= startDate && 
             reqDate <= endDate &&
             req.status === "Approved";
    });

    const leaveTypes = ["CL", "EL", "ML", "CO", "VL", "OD"];
    const leaveTypeStats: {
      leaveCode: string;
      leaveName: string;
      requestCount: number;
      totalDays: number;
      averageDaysPerRequest: number;
      percentageOfTotal: number;
      color: string;
    }[] = [];

    let totalDaysAll = 0;
    let totalRequestsAll = 0;

    for (const type of leaveTypes) {
      const typeRequests = filteredRequests.filter(r => r.leaveType === type);
      const totalDays = typeRequests.reduce((sum, r) => sum + r.totalDays, 0);
      const requestCount = typeRequests.length;
      totalDaysAll += totalDays;
      totalRequestsAll += requestCount;
      
      leaveTypeStats.push({
        leaveCode: type,
        leaveName: LEAVE_TYPE_LABELS[type] || type,
        requestCount,
        totalDays,
        averageDaysPerRequest: requestCount > 0 ? parseFloat((totalDays / requestCount).toFixed(1)) : 0,
        percentageOfTotal: 0,
        color: LEAVE_TYPE_COLORS[type] || "#6B7280",
      });
    }

    for (const stat of leaveTypeStats) {
      stat.percentageOfTotal = totalDaysAll > 0 ? parseFloat(((stat.totalDays / totalDaysAll) * 100).toFixed(1)) : 0;
    }

    const departmentBreakdown: {
      leaveType: string;
      departments: { departmentName: string; totalDays: number; requestCount: number }[];
    }[] = [];

    const departmentMap = new Map<string, string>();
    for (const user of collegeUsers) {
      departmentMap.set(user.uid, user.departmentName);
    }

    for (const type of leaveTypes) {
      const typeRequests = filteredRequests.filter(r => r.leaveType === type);
      const deptMap = new Map<string, { departmentName: string; totalDays: number; requestCount: number }>();
      
      for (const req of typeRequests) {
        const deptName = departmentMap.get(req.applicantId) || "Unknown";
        if (!deptMap.has(deptName)) {
          deptMap.set(deptName, { departmentName: deptName, totalDays: 0, requestCount: 0 });
        }
        const dept = deptMap.get(deptName)!;
        dept.totalDays += req.totalDays;
        dept.requestCount++;
      }
      
      departmentBreakdown.push({
        leaveType: type,
        departments: Array.from(deptMap.values()).sort((a, b) => b.totalDays - a.totalDays),
      });
    }

    const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
    const monthlyTrend: {
      month: string;
      CL: number;
      EL: number;
      ML: number;
      CO: number;
      VL: number;
      OD: number;
    }[] = [];

    for (let i = 0; i < months.length; i++) {
      const monthDate = new Date(i < 7 ? startYear : endYear, (i + 5) % 12, 1);
      const monthRequests = filteredRequests.filter(req => {
        const reqDate = new Date(req.createdAt);
        return reqDate.getMonth() === monthDate.getMonth() && reqDate.getFullYear() === monthDate.getFullYear();
      });
      
      const monthData: { month: string; CL: number; EL: number; ML: number; CO: number; VL: number; OD: number } = {
        month: `${months[i]} ${monthDate.getFullYear()}`,
        CL: 0,
        EL: 0,
        ML: 0,
        CO: 0,
        VL: 0,
        OD: 0,
      };
      
      for (const type of leaveTypes) {
        const count = monthRequests.filter(r => r.leaveType === type).length;
        if (type === "CL") monthData.CL = count;
        else if (type === "EL") monthData.EL = count;
        else if (type === "ML") monthData.ML = count;
        else if (type === "CO") monthData.CO = count;
        else if (type === "VL") monthData.VL = count;
        else if (type === "OD") monthData.OD = count;
      }
      
      monthlyTrend.push(monthData);
    }

    return NextResponse.json({
      academicYear,
      summary: {
        totalRequests: totalRequestsAll,
        totalDays: totalDaysAll,
        averageDaysPerRequest: totalRequestsAll > 0 ? parseFloat((totalDaysAll / totalRequestsAll).toFixed(1)) : 0,
      },
      leaveTypeStats,
      departmentBreakdown,
      monthlyTrend,
    });
  } catch (error) {
    console.error("Error generating leave type report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}