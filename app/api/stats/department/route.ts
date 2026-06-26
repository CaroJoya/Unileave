import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

// Define types
interface Department {
  id: string;
  name: string;
  collegeId?: string;
  hodId?: string | null;
  hodName?: string | null;
  isActive?: boolean;
}

interface LeaveRequest {
  id: string;
  applicantId: string;
  departmentId: string;
  departmentName?: string;
  totalDays: number;
  status: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
}

interface UserData {
  roles?: string[];
  collegeId?: string;
}

interface DepartmentStats {
  leaves: number;
  pending: number;
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
    const userId = decodedToken.uid;

    // Get user data
    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = userSnapshot.val() as UserData | null;

    // Check if user is HOD or Registrar
    const isHodOrRegistrar = userData?.roles?.some((r: string) => 
      r === "hod" || r === "registrar"
    ) || false;

    if (!isHodOrRegistrar) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get all departments
    const deptsSnapshot = await rtdb.ref("departments").once("value");
    const departments = deptsSnapshot.val() as Record<string, Department> | null || {};

    // Get all leave requests
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Calculate department stats
    const deptStats: Record<string, DepartmentStats> = {};

    // Initialize stats for each department
    for (const deptId of Object.keys(departments)) {
      deptStats[deptId] = { leaves: 0, pending: 0 };
    }

    // Process leave requests
    for (const request of Object.values(allRequests)) {
      const deptId = request.departmentId;
      if (deptId && deptStats[deptId]) {
        deptStats[deptId].leaves += request.totalDays || 1;
        if (request.status?.includes("Pending")) {
          deptStats[deptId].pending += 1;
        }
      }
    }

    // Convert to array format
    const departmentsList = Object.entries(deptStats).map(([id, stats]) => ({
      department: departments[id]?.name || id,
      leaves: stats.leaves,
      pending: stats.pending,
    }));

    return NextResponse.json({ departments: departmentsList });
  } catch (error) {
    console.error("Error fetching department stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch department stats" },
      { status: 500 }
    );
  }
}