// app/api/headclerk/attendance/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

// Define interfaces for type safety
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
}

interface DepartmentRecord {
  id: string;
  name: string;
  hodId: string | null;
  hodName: string | null;
  isActive: boolean;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString());
    const departmentId = searchParams.get("departmentId") || "";
    const userId = searchParams.get("userId") || "";

    // 🆕 FIX: Use UTC dates to avoid timezone issues
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0));
    
    // Format: YYYY-MM for display
    const monthStr = `${year}-${month.toString().padStart(2, "0")}`;
    
    // Get all attendance records for the month
    const attendanceSnapshot = await rtdb.ref("attendance").once("value");
    const allAttendance = attendanceSnapshot.val() as Record<string, AttendanceRecord> | null || {};
    
    // 🆕 Filter by month using UTC dates
    const filteredAttendance = Object.values(allAttendance).filter((record: AttendanceRecord) => {
      if (!record.date) return false;
      const recordDate = new Date(record.date);
      return recordDate >= startDate && recordDate <= endDate;
    });
    
    // Apply filters
    let results = filteredAttendance;
    if (departmentId) {
      results = results.filter((record: AttendanceRecord) => record.departmentId === departmentId);
    }
    if (userId) {
      results = results.filter((record: AttendanceRecord) => record.userId === userId);
    }

    // Get all users for faculty list
    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, UserRecord> | null || {};
    
    // Get faculty/LA/office staff users
    const staffUsers = Object.entries(users)
      .filter(([, user]: [string, UserRecord]) => {
        const roles = user.roles || [];
        return roles.includes("faculty") || 
               roles.includes("lab_assistant") || 
               roles.includes("office_staff");
      })
      .map(([uid, user]: [string, UserRecord]) => ({
        uid,
        name: user.name,
        email: user.email,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        roles: user.roles,
      }));

    // Get departments
    const deptsSnapshot = await rtdb.ref("departments").once("value");
    const departments = deptsSnapshot.val() as Record<string, DepartmentRecord> | null || {};

    const departmentsList = Object.entries(departments).map(([id, data]: [string, DepartmentRecord]) => ({
      id,
      name: data.name,
    }));

    // 🆕 Add month summary
    const summary = {
      totalRecords: results.length,
      present: results.filter(r => r.status === "Present").length,
      absent: results.filter(r => r.status === "Absent").length,
      halfDay: results.filter(r => r.status === "Half Day").length,
    };

    return NextResponse.json({
      attendance: results,
      users: staffUsers,
      departments: departmentsList,
      summary,
      month: monthStr,
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
  }
}