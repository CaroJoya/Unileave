// app/api/principal/vacation/route.ts
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
  roles: string[];
  collegeId: string;
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
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as User | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    const collegeId = principalData.collegeId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const vacationRequests = Object.values(allRequests)
      .filter(req => 
        collegeUserIds.includes(req.applicantId) &&
        req.status === "Pending_Principal" &&
        req.leaveType === "VL"
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ requests: vacationRequests });
  } catch (error) {
    console.error("Error fetching vacation requests:", error);
    return NextResponse.json({ error: "Failed to fetch vacation requests" }, { status: 500 });
  }
}