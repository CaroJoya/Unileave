// app/api/headclerk/attendance/export/route.ts - COMPLETE FIXED FILE WITH COLLEGE ISOLATION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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
  roles: string[];
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
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // ✅ Get the Head Clerk's college ID
    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month") || (new Date().getMonth() + 1).toString();
    const departmentId = searchParams.get("departmentId") || "";
    const format = searchParams.get("format") || "json";

    const monthStr = `${year}-${month.padStart(2, "0")}`;
    
    // ✅ Get ALL users in the SAME college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, UserRecord> | null || {};
    
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);
    
    const attendanceSnapshot = await rtdb.ref("attendance").once("value");
    const allAttendance = attendanceSnapshot.val() as Record<string, AttendanceRecord> | null || {};
    
    // ✅ Filter attendance records by college users
    let records = Object.values(allAttendance).filter((record: AttendanceRecord) => {
      const recordDate = record.date?.split("T")[0] || "";
      if (!recordDate) return false;
      if (!collegeUserIds.includes(record.userId)) return false;
      return recordDate.substring(0, 7) === monthStr;
    });
    
    if (departmentId) {
      records = records.filter((record: AttendanceRecord) => record.departmentId === departmentId);
    }

    if (format === "csv") {
      const headers = ["Date", "Employee Name", "Department", "Status", "Half Day Session", "Remarks", "Marked By"];
      const csvRows = [headers];
      
      for (const record of records) {
        csvRows.push([
          record.date?.split("T")[0] || "",
          record.userName,
          record.departmentName,
          record.status,
          record.halfDaySession || "",
          record.remarks || "",
          record.markedByName,
        ]);
      }
      
      const csvContent = csvRows.map(row => row.join(",")).join("\n");
      
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="attendance_${monthStr}.csv"`,
        },
      });
    }

    return NextResponse.json({ attendance: records });
  } catch (error) {
    console.error("Error exporting attendance:", error);
    return NextResponse.json({ error: "Failed to export attendance" }, { status: 500 });
  }
}