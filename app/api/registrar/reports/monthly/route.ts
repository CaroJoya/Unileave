// app/api/registrar/reports/monthly/route.ts - FIXED
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
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());
    const departmentId = searchParams.get("departmentId") || "";

    const collegeId = registrarData.collegeId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    const collegeUsers = Object.entries(allUsers)
      .filter(([, user]) => {
        if (user.collegeId !== collegeId) return false;
        if (departmentId && user.departmentId !== departmentId) return false;
        return true;
      })
      .map(([uid, user]) => ({ ...user, uid }));
    
    const userIds = collegeUsers.map(u => u.uid);

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const filteredRequests = Object.values(allRequests).filter(req => {
      const reqDate = new Date(req.createdAt);
      return userIds.includes(req.applicantId) && 
             reqDate.getFullYear() === year && 
             reqDate.getMonth() + 1 === month;
    });

    const totalRequests = filteredRequests.length;
    const approved = filteredRequests.filter(req => req.status === "Approved").length;
    const rejected = filteredRequests.filter(req => 
      req.status === "Rejected_HOD" || req.status === "Rejected_Registrar" || req.status === "Rejected_Principal"
    ).length;
    const pending = filteredRequests.filter(req => 
      req.status === "Pending_HOD" || req.status === "Pending_Registrar" || req.status === "Pending_Principal"
    ).length;
    const revision = filteredRequests.filter(req => req.status === "Pending_Revision").length;

    const departmentBreakdownMap: Record<string, { departmentName: string; total: number; approved: number; rejected: number }> = {};
    for (const req of filteredRequests) {
      if (!departmentBreakdownMap[req.departmentId]) {
        departmentBreakdownMap[req.departmentId] = {
          departmentName: req.departmentName,
          total: 0,
          approved: 0,
          rejected: 0,
        };
      }
      departmentBreakdownMap[req.departmentId].total++;
      if (req.status === "Approved") departmentBreakdownMap[req.departmentId].approved++;
      if (req.status.includes("Rejected")) departmentBreakdownMap[req.departmentId].rejected++;
    }
    const departmentBreakdown = Object.values(departmentBreakdownMap);

    const leaveTypeBreakdown: Record<string, { count: number; totalDays: number }> = {};
    const leaveTypes = ["CL", "EL", "ML", "CO", "VL", "OD"];
    for (const type of leaveTypes) {
      leaveTypeBreakdown[type] = { count: 0, totalDays: 0 };
    }
    for (const req of filteredRequests) {
      if (leaveTypeBreakdown[req.leaveType]) {
        leaveTypeBreakdown[req.leaveType].count++;
        leaveTypeBreakdown[req.leaveType].totalDays += req.totalDays;
      }
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyBreakdown: { date: string; total: number; approved: number; rejected: number }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
      const dayRequests = filteredRequests.filter(req => {
        const reqDate = new Date(req.createdAt).toISOString().split("T")[0];
        return reqDate === dateStr;
      });
      dailyBreakdown.push({
        date: dateStr,
        total: dayRequests.length,
        approved: dayRequests.filter(r => r.status === "Approved").length,
        rejected: dayRequests.filter(r => r.status.includes("Rejected")).length,
      });
    }

    return NextResponse.json({
      summary: {
        year,
        month,
        monthName: new Date(year, month - 1).toLocaleString("default", { month: "long" }),
        totalRequests,
        approved,
        rejected,
        pending,
        revision,
        approvalRate: totalRequests > 0 ? ((approved / totalRequests) * 100).toFixed(1) : "0",
      },
      departmentBreakdown,
      leaveTypeBreakdown,
      dailyBreakdown,
    });
  } catch (error) {
    console.error("Error generating monthly report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}