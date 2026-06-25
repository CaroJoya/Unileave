// app/api/registrar/reports/overrides/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  departmentId: string;
  departmentName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  overriddenBy: string | null;
  overriddenAt: string | null;
  overrideReason: string | null;
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

interface ApprovalLog {
  id: string;
  leaveRequestId: string;
  actionBy: string;
  actionByName: string;
  actionRole: string;
  action: string;
  remark: string | null;
  oldStatus: string;
  newStatus: string;
  actionAt: string;
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
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const departmentId = searchParams.get("departmentId") || "";

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const logsSnapshot = await rtdb.ref("approvalLogs").once("value");
    const allLogs = logsSnapshot.val() as Record<string, ApprovalLog> | null || {};

    let overrideRequests = Object.values(allRequests).filter(req => 
      req.overriddenBy !== null && req.overriddenBy !== undefined
    );

    if (startDate) {
      overrideRequests = overrideRequests.filter(req => new Date(req.overriddenAt || "") >= new Date(startDate));
    }
    if (endDate) {
      overrideRequests = overrideRequests.filter(req => new Date(req.overriddenAt || "") <= new Date(endDate));
    }
    if (departmentId) {
      overrideRequests = overrideRequests.filter(req => req.departmentId === departmentId);
    }

    const overridesWithDetails = overrideRequests.map(req => {
      const overrideLog = Object.values(allLogs).find(
        log => log.leaveRequestId === req.id && log.action === "PRINCIPAL_OVERRIDE"
      );
      
      const previousLog = overrideLog ? Object.values(allLogs).find(
        log => log.leaveRequestId === req.id && log.actionAt < overrideLog.actionAt && log.action === "APPROVE"
      ) : null;
      
      const originalApprover = previousLog?.actionByName || "Unknown";
      const originalApproverRole = previousLog?.actionRole || "hod";
      const overriddenByUser = overrideLog?.actionByName || req.overriddenBy || "Unknown";
      const overriddenByRole = overrideLog?.actionRole || "principal";

      return {
        requestId: req.id,
        applicantName: req.applicantName,
        departmentName: req.departmentName,
        leaveType: req.leaveType,
        startDate: req.startDate,
        endDate: req.endDate,
        totalDays: req.totalDays,
        originalApprover,
        originalApproverRole,
        overriddenBy: overriddenByUser,
        overriddenByRole,
        overrideReason: req.overrideReason,
        overriddenAt: req.overriddenAt,
        finalStatus: req.status,
      };
    });

    overridesWithDetails.sort((a, b) => 
      new Date(b.overriddenAt || "").getTime() - new Date(a.overriddenAt || "").getTime()
    );

    const totalOverrides = overrideRequests.length;
    const overridesByReason: Record<string, number> = {};
    const overridesByDepartment: Record<string, number> = {};
    const overridesByMonth: Record<string, number> = {};

    for (const req of overrideRequests) {
      const reason = req.overrideReason || "No reason provided";
      overridesByReason[reason] = (overridesByReason[reason] || 0) + 1;
      
      overridesByDepartment[req.departmentName] = (overridesByDepartment[req.departmentName] || 0) + 1;
      
      if (req.overriddenAt) {
        const monthKey = new Date(req.overriddenAt).toLocaleString("default", { month: "short", year: "numeric" });
        overridesByMonth[monthKey] = (overridesByMonth[monthKey] || 0) + 1;
      }
    }

    const overridesByDepartmentArray = Object.entries(overridesByDepartment).map(([name, count]) => ({ department: name, count }));
    const overridesByReasonArray = Object.entries(overridesByReason).map(([reason, count]) => ({ reason: reason.substring(0, 50), count }));
    const overridesByMonthArray = Object.entries(overridesByMonth).map(([month, count]) => ({ month, count }));

    return NextResponse.json({
      summary: {
        totalOverrides,
        uniqueDepartments: Object.keys(overridesByDepartment).length,
        uniqueReasons: Object.keys(overridesByReason).length,
      },
      overridesByDepartment: overridesByDepartmentArray,
      overridesByReason: overridesByReasonArray,
      overridesByMonth: overridesByMonthArray,
      overrides: overridesWithDetails,
    });
  } catch (error) {
    console.error("Error generating override report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}