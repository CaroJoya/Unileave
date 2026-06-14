// app/api/hod/vacation/route.ts
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
  status: string;
  createdAt: string;
  vacationDetails?: {
    vacationType: string;
    paidDays: number;
    unpaidDays: number;
  };
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  status: string;
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
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as User | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized - HOD only" }, { status: 403 });
    }

    const departmentId = hodData.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: "HOD not assigned to department" }, { status: 400 });
    }

    // Get all leave requests
    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Filter for department faculty/lab assistant with Pending_HOD status and vacation type
    const vacationRequests = Object.values(allRequests).filter(req => 
      req.departmentId === departmentId &&
      req.status === "Pending_HOD" &&
      req.leaveType === "VL" &&
      (req.applicantRoles?.includes("faculty") || req.applicantRoles?.includes("lab_assistant"))
    );

    // Sort by createdAt descending (newest first)
    vacationRequests.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      requests: vacationRequests,
    });
  } catch (error) {
    console.error("Error fetching vacation requests:", error);
    return NextResponse.json({ error: "Failed to fetch vacation requests" }, { status: 500 });
  }
}