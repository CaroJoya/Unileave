// app/api/registrar/reports/overrides/route.ts
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
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const departmentId = searchParams.get("departmentId") || "";

    // Get all leave requests
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Get approval logs for override tracking
    const logsSnapshot = await rtdb.ref("approvalLogs").once("value");
    const allLogs = logsSnapshot.val() as Record<string, ApprovalLog> | null || {};

    // Filter override requests
    let overrideRequests = Object.values(allRequests).filter(req => 
      req.overriddenBy !== null && req.overriddenBy !== undefined
    );

    // Apply date filters
    if (startDate) {
      overrideRequests = overrideRequests.filter(req => new Date(req.overriddenAt || "") >= new Date(startDate));
    }
    if (endDate) {
      overrideRequests = overrideRequests.filter(req => new Date(req.overriddenAt || "") <= new Date(endDate));
    }
    if (departmentId) {
      overrideRequests = overrideRequests.filter(req => req.departmentId === departmentId);
    }

    // Get the original approval chain for each override
    const overridesWithDetails = overrideRequests.map(req => {
      // Find the approval log that shows where the override happened
      const overrideLog = Object.values(allLogs).find(
        log => log.leaveRequestId === req.id && log.action === "PRINCIPAL_OVERRIDE"
      );
      
      // Find the original status before override
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

    // Sort by override date descending
    overridesWithDetails.sort((a, b) => 
      new Date(b.overriddenAt || "").getTime() - new Date(a.overriddenAt || "").getTime()
    );

    // Summary statistics
    const totalOverrides = overrideRequests.length;
    const overridesByReason: Record<string, number> = {};
    const overridesByDepartment: Record<string, number> = {};
    const overridesByMonth: Record<string, number> = {};

    for (const req of overrideRequests) {
      // By reason
      const reason = req.overrideReason || "No reason provided";
      overridesByReason[reason] = (overridesByReason[reason] || 0) + 1;
      
      // By department
      overridesByDepartment[req.departmentName] = (overridesByDepartment[req.departmentName] || 0) + 1;
      
      // By month
      if (req.overriddenAt) {
        const monthKey = new Date(req.overriddenAt).toLocaleString("default", { month: "short", year: "numeric" });
        overridesByMonth[monthKey] = (overridesByMonth[monthKey] || 0) + 1;
      }
    }

    // Convert to arrays for easier consumption
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