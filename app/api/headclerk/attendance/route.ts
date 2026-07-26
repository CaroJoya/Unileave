// app/api/headclerk/attendance/route.ts - WITH SUPER ADMIN SUPPORT
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { hasHeadClerkOrSuperAdminRights } from "@/lib/utils/roles";

interface AttendanceRecord {
  id?: string;
  userId: string;
  userName: string;
  departmentId: string;
  departmentName: string;
  date: string;
  status: string;
  halfDaySession: string | null;
  remarks: string | null;
  markedBy: string;
  markedByName: string;
  createdAt: string;
  updatedAt: string;
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  status: string;
  isEmployed: boolean;
  dateOfJoining?: string;
  collegeId: string;
  collegeName: string;
}

interface DepartmentRecord {
  id: string;
  name: string;
  hodId: string | null;
  hodName: string | null;
  isActive: boolean;
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
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;
    
    if (!userData || !hasHeadClerkOrSuperAdminRights(userData.roles || [])) {
      return NextResponse.json({ error: "Not authorized - Head Clerk or Super Admin only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "User has no college assigned" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());
    const departmentId = searchParams.get("departmentId") || "";
    const userId = searchParams.get("userId") || "";

    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = parseInt(searchParams.get("offset") || "0");

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));
    
    const attendanceSnapshot = await rtdb.ref("attendance").once("value");
    const allAttendance = attendanceSnapshot.val() as Record<string, AttendanceRecord> | null || {};
    
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, UserRecord> | null || {};
    
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);
    
    let results = Object.values(allAttendance).filter((record: AttendanceRecord) => {
      if (!record.date) return false;
      if (!collegeUserIds.includes(record.userId)) return false;
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
    
    if (departmentId) {
      results = results.filter((record: AttendanceRecord) => record.departmentId === departmentId);
    }
    if (userId) {
      results = results.filter((record: AttendanceRecord) => record.userId === userId);
    }

    const totalResults = results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    const hasMore = offset + limit < totalResults;

    const staffUsers = Object.entries(allUsers)
      .filter(([, user]: [string, UserRecord]) => {
        const roles = user.roles || [];
        return (roles.includes("faculty") || 
                roles.includes("lab_assistant") || 
                roles.includes("office_staff")) &&
                user.collegeId === collegeId &&
                user.status !== "deleted";
      })
      .map(([uid, user]: [string, UserRecord]) => ({
        uid,
        name: user.name,
        email: user.email,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        roles: user.roles,
      }));

    const deptsSnapshot = await rtdb.ref("departments").once("value");
    const departments = deptsSnapshot.val() as Record<string, DepartmentRecord> | null || {};

    const departmentsList = Object.entries(departments)
      .filter(([, data]: [string, DepartmentRecord]) => data.collegeId === collegeId)
      .map(([id, data]: [string, DepartmentRecord]) => ({
        id,
        name: data.name,
      }));

    const summary = {
      totalRecords: totalResults,
      present: results.filter(r => r.status === "Present").length,
      absent: results.filter(r => r.status === "Absent").length,
      halfDay: results.filter(r => r.status === "Half Day").length,
    };

    const response = NextResponse.json({
      attendance: paginatedResults,
      users: staffUsers,
      departments: departmentsList,
      summary,
      month: `${year}-${month.toString().padStart(2, "0")}`,
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
    console.error("Error fetching attendance:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}