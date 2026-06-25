// app/api/hod/requests/route.ts - FIXED
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
  attachmentUrl: string | null;
  status: string;
  createdAt: string;
  revisionCount: number;
}

interface RevisionHistory {
  id: string;
  leaveRequestId: string;
  cycleNumber: number;
  remarkText: string;
  remarkSentByName: string;
  remarkSentAt: string;
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
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as User | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const departmentId = hodData.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: "HOD not assigned to department" }, { status: 400 });
    }

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const filteredRequests = Object.values(allRequests).filter(req => 
      req.departmentId === departmentId &&
      req.status === "Pending_HOD" &&
      (req.applicantRoles?.includes("faculty") || req.applicantRoles?.includes("lab_assistant"))
    );

    const revisionSnapshot = await rtdb.ref("revisionHistory").once("value");
    const allRevisions = revisionSnapshot.val() as Record<string, RevisionHistory> | null || {};

    const requestsWithRevisions = filteredRequests.map(req => {
      const requestRevisions = Object.values(allRevisions).filter(
        (rev) => rev.leaveRequestId === req.id
      );
      return {
        ...req,
        revisionCount: requestRevisions.length,
        revisionHistory: requestRevisions,
      };
    });

    requestsWithRevisions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      requests: requestsWithRevisions,
    });
  } catch (error) {
    console.error("Error fetching HOD requests:", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}