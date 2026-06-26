// app/api/registrar/vacation/route.ts - COMPLETE FILE
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
  collegeId: string;
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
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    const collegeId = registrarData.collegeId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, User> | null || {};
    
    // ✅ FIXED: Get ALL users in college
    const collegeUserIds = Object.entries(users)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const vacationRequests = Object.values(allRequests).filter(req => 
      collegeUserIds.includes(req.applicantId) &&
      req.status === "Pending_Registrar" &&
      req.leaveType === "VL"
    );

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