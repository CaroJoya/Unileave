// app/api/registrar/leaves/route.ts - COMPLETE FILE
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
  collegeId: string;
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
    const view = searchParams.get("view") || "pending";
    const departmentId = searchParams.get("departmentId") || "";
    const role = searchParams.get("role") || "";
    const leaveType = searchParams.get("leaveType") || "";
    const status = searchParams.get("status") || "";
    const academicYear = searchParams.get("academicYear") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const search = searchParams.get("search") || "";

    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    const collegeId = registrarData.collegeId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    // ✅ FIXED: Get ALL users in college, not just office_staff and head_clerk
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);

    const leaveSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = leaveSnapshot.val() as Record<string, LeaveRequest> | null || {};

    let filteredRequests = Object.values(allRequests).filter(req => 
      collegeUserIds.includes(req.applicantId)
    );

    if (view === "pending") {
      filteredRequests = filteredRequests.filter(req => req.status === "Pending_Registrar");
    }

    if (departmentId) {
      filteredRequests = filteredRequests.filter(req => req.departmentId === departmentId);
    }
    if (role) {
      filteredRequests = filteredRequests.filter(req => req.applicantRoles?.includes(role));
    }
    if (leaveType) {
      filteredRequests = filteredRequests.filter(req => req.leaveType === leaveType);
    }
    if (status) {
      filteredRequests = filteredRequests.filter(req => req.status === status);
    }
    if (search) {
      filteredRequests = filteredRequests.filter(req => 
        req.applicantName.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (startDate) {
      filteredRequests = filteredRequests.filter(req => new Date(req.startDate) >= new Date(startDate));
    }
    if (endDate) {
      filteredRequests = filteredRequests.filter(req => new Date(req.endDate) <= new Date(endDate));
    }
    if (academicYear) {
      const [year] = academicYear.split("-");
      filteredRequests = filteredRequests.filter(req => 
        new Date(req.createdAt).getFullYear().toString() === year
      );
    }

    filteredRequests.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalResults = filteredRequests.length;
    const paginatedRequests = filteredRequests.slice(offset, offset + limit);
    const hasMore = offset + limit < totalResults;

    const revisionSnapshot = await rtdb.ref("revisionHistory").once("value");
    const allRevisions = revisionSnapshot.val() as Record<string, RevisionHistory> | null || {};

    const requestsWithRevisions = paginatedRequests.map(req => {
      const requestRevisions = Object.values(allRevisions).filter(
        (rev) => rev.leaveRequestId === req.id
      );
      return {
        ...req,
        revisionCount: requestRevisions.length,
        revisionHistory: requestRevisions,
      };
    });

    const departmentsSnapshot = await rtdb.ref("departments").once("value");
    const departments = departmentsSnapshot.val() as Record<string, { id: string; name: string }> | null || {};
    const departmentsList = Object.values(departments).map((dept) => ({
      id: dept.id,
      name: dept.name,
    }));

    const response = NextResponse.json({
      requests: requestsWithRevisions,
      departments: departmentsList,
      pagination: {
        limit,
        offset,
        hasMore,
        total: totalResults,
      },
    });

    response.headers.set("X-Total-Count", String(totalResults));
    response.headers.set("X-Limit", String(limit));
    response.headers.set("X-Offset", String(offset));

    return response;
  } catch (error) {
    console.error("Error fetching registrar leaves:", error);
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }
}