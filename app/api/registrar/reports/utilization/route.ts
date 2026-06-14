// app/api/registrar/reports/utilization/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";

interface LeaveRequest {
  id: string;
  applicantId: string;
  departmentId: string;
  departmentName: string;
  leaveType: string;
  totalDays: number;
  status: string;
  createdAt: string;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  available: number;
}

interface LeaveBalancesDoc {
  userId: string;
  academicYear: string;
  balances: Record<string, LeaveBalance>;
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
    const academicYear = searchParams.get("academicYear") || getCurrentAcademicYear();

    const collegeId = registrarData.collegeId;

    // Get all departments
    const departmentsSnapshot = await rtdb.ref("departments").once("value");
    const departments = departmentsSnapshot.val() || {};

    // Get all users in college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    const collegeUsers = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId && user.status === "active")
      .map(([uid, user]) => ({ ...user, uid }));

    // Get leave balances
    const balancesSnapshot = await rtdb.ref("leaveBalances").once("value");
    const allBalances = balancesSnapshot.val() as Record<string, LeaveBalancesDoc> | null || {};

    // Get leave requests for the academic year
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Parse academic year for date filtering
    const [startYear, endYear] = academicYear.split("-").map(Number);
    const startDate = new Date(startYear, 5, 1);
    const endDate = new Date(endYear, 4, 31);

    const yearRequests = Object.values(allRequests).filter(req => {
      const reqDate = new Date(req.createdAt);
      return reqDate >= startDate && reqDate <= endDate && req.status === "Approved";
    });

    // Department utilization
    const departmentUtilization: {
      departmentId: string;
      departmentName: string;
      employeeCount: number;
      allocatedLeaves: number;
      usedLeaves: number;
      remainingLeaves: number;
      utilizationPercent: number;
    }[] = [];

    for (const [deptId, dept] of Object.entries(departments as Record<string, { id: string; name: string }>)) {
      const deptUsers = collegeUsers.filter(u => u.departmentId === deptId);
      const employeeCount = deptUsers.length;
      
      // Calculate allocated leaves (sum of all users' CL + EL + ML)
      let allocatedLeaves = 0;
      for (const user of deptUsers) {
        const balanceKey = `${user.uid}_${academicYear}`;
        const balance = allBalances[balanceKey];
        if (balance?.balances) {
          allocatedLeaves += (balance.balances.CL?.allocated || 0);
          allocatedLeaves += (balance.balances.EL?.allocated || 0);
          allocatedLeaves += (balance.balances.ML?.allocated || 0);
        }
      }
      
      // Calculate used leaves from approved requests
      let usedLeaves = 0;
      for (const req of yearRequests) {
        const user = collegeUsers.find(u => u.uid === req.applicantId);
        if (user?.departmentId === deptId) {
          usedLeaves += req.totalDays;
        }
      }
      
      const remainingLeaves = Math.max(0, allocatedLeaves - usedLeaves);
      const utilizationPercent = allocatedLeaves > 0 ? (usedLeaves / allocatedLeaves) * 100 : 0;
      
      departmentUtilization.push({
        departmentId: deptId,
        departmentName: dept.name,
        employeeCount,
        allocatedLeaves,
        usedLeaves,
        remainingLeaves,
        utilizationPercent: parseFloat(utilizationPercent.toFixed(1)),
      });
    }

    // Sort by utilization percent descending
    departmentUtilization.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

    // Overall college totals
    const totalAllocated = departmentUtilization.reduce((sum, d) => sum + d.allocatedLeaves, 0);
    const totalUsed = departmentUtilization.reduce((sum, d) => sum + d.usedLeaves, 0);
    const totalRemaining = departmentUtilization.reduce((sum, d) => sum + d.remainingLeaves, 0);
    const overallUtilization = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;

    return NextResponse.json({
      academicYear,
      summary: {
        totalDepartments: departmentUtilization.length,
        totalEmployees: collegeUsers.length,
        totalAllocated,
        totalUsed,
        totalRemaining,
        overallUtilization: parseFloat(overallUtilization.toFixed(1)),
      },
      departments: departmentUtilization,
    });
  } catch (error) {
    console.error("Error generating utilization report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}