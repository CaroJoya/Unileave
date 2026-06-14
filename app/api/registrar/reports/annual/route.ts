// app/api/registrar/reports/annual/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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
  collegeId: string;
  collegeName: string;
  status: string;
}

export async function GET(request: Request) {
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

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academicYear = searchParams.get("academicYear") || "";
    const departmentId = searchParams.get("departmentId") || "";

    const collegeId = registrarData.collegeId;

    // Parse academic year (e.g., "2024-2025")
    let startYear: number, endYear: number;
    if (academicYear) {
      const [start, end] = academicYear.split("-").map(Number);
      startYear = start;
      endYear = end;
    } else {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      if (currentMonth >= 5) {
        startYear = currentYear;
        endYear = currentYear + 1;
      } else {
        startYear = currentYear - 1;
        endYear = currentYear;
      }
    }

    const startDate = new Date(startYear, 5, 1); // June 1
    const endDate = new Date(endYear, 4, 31); // May 31

    // Get all users in college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    // Filter users by college and department
    const collegeUsers = Object.entries(allUsers)
      .filter(([, user]) => {
        if (user.collegeId !== collegeId) return false;
        if (departmentId && user.departmentId !== departmentId) return false;
        return true;
      })
      .map(([uid, user]) => ({ ...user, uid }));
    
    const userIds = collegeUsers.map(u => u.uid);

    // Get all leave requests for the academic year
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const filteredRequests = Object.values(allRequests).filter(req => {
      const reqDate = new Date(req.createdAt);
      return userIds.includes(req.applicantId) && reqDate >= startDate && reqDate <= endDate;
    });

    // Monthly breakdown
    const monthlyBreakdown: { month: string; total: number; approved: number; rejected: number }[] = [];
    const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
    for (let i = 0; i < months.length; i++) {
      const monthDate = new Date(i < 7 ? startYear : endYear, (i + 5) % 12, 1);
      const monthRequests = filteredRequests.filter(req => {
        const reqDate = new Date(req.createdAt);
        return reqDate.getMonth() === monthDate.getMonth() && reqDate.getFullYear() === monthDate.getFullYear();
      });
      monthlyBreakdown.push({
        month: `${months[i]} ${monthDate.getFullYear()}`,
        total: monthRequests.length,
        approved: monthRequests.filter(r => r.status === "Approved").length,
        rejected: monthRequests.filter(r => r.status.includes("Rejected")).length,
      });
    }

    // Department summary
    const departmentSummaryMap: Record<string, { departmentName: string; total: number; approved: number; totalDays: number }> = {};
    for (const req of filteredRequests) {
      if (!departmentSummaryMap[req.departmentId]) {
        departmentSummaryMap[req.departmentId] = {
          departmentName: req.departmentName,
          total: 0,
          approved: 0,
          totalDays: 0,
        };
      }
      departmentSummaryMap[req.departmentId].total++;
      departmentSummaryMap[req.departmentId].totalDays += req.totalDays;
      if (req.status === "Approved") departmentSummaryMap[req.departmentId].approved++;
    }
    const departmentSummary = Object.values(departmentSummaryMap);

    // Leave type annual summary
    const leaveTypeSummary: Record<string, { count: number; totalDays: number }> = {};
    const leaveTypes = ["CL", "EL", "ML", "CO", "VL", "OD"];
    for (const type of leaveTypes) {
      leaveTypeSummary[type] = { count: 0, totalDays: 0 };
    }
    for (const req of filteredRequests) {
      if (leaveTypeSummary[req.leaveType]) {
        leaveTypeSummary[req.leaveType].count++;
        leaveTypeSummary[req.leaveType].totalDays += req.totalDays;
      }
    }

    const totalRequests = filteredRequests.length;
    const totalApproved = filteredRequests.filter(r => r.status === "Approved").length;
    const totalRejected = filteredRequests.filter(r => r.status.includes("Rejected")).length;
    const totalDays = filteredRequests.reduce((sum, r) => sum + r.totalDays, 0);

    return NextResponse.json({
      academicYear: `${startYear}-${endYear}`,
      summary: {
        totalRequests,
        totalApproved,
        totalRejected,
        totalDays,
        averagePerMonth: (totalRequests / 12).toFixed(1),
        approvalRate: totalRequests > 0 ? ((totalApproved / totalRequests) * 100).toFixed(1) : "0",
      },
      monthlyBreakdown,
      departmentSummary,
      leaveTypeSummary,
    });
  } catch (error) {
    console.error("Error generating annual report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}