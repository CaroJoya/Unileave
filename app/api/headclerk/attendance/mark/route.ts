// app/api/headclerk/attendance/mark/route.ts - COMPLETE FIXED FILE WITH COLLEGE ISOLATION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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

export async function POST(request: Request) {
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

    const body = await request.json();
    const { userId, date, status, remarks, halfDaySession } = body;

    if (!userId || !date || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (status !== "Present" && status !== "Absent" && status !== "Half Day") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const targetUserSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const targetUser = targetUserSnapshot.val() as UserRecord | null;

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ Verify the target user is in the same college
    if (targetUser.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "Not authorized to mark attendance for users from other colleges" 
      }, { status: 403 });
    }

    const attendanceSnapshot = await rtdb.ref("attendance").once("value");
    const allAttendance = attendanceSnapshot.val() as Record<string, AttendanceRecord> | null || {};
    
    let existingId: string | null = null;
    for (const [id, record] of Object.entries(allAttendance)) {
      const recordDate = record.date?.split("T")[0] || "";
      if (record.userId === userId && recordDate === date) {
        existingId = id;
        break;
      }
    }

    const attendanceData = {
      userId,
      userName: targetUser.name,
      departmentId: targetUser.departmentId,
      departmentName: targetUser.departmentName,
      date: new Date(date).toISOString(),
      status,
      remarks: remarks || null,
      halfDaySession: status === "Half Day" ? (halfDaySession || null) : null,
      markedBy: decodedToken.uid,
      markedByName: userData.name,
      updatedAt: new Date().toISOString(),
    };

    if (existingId) {
      const existingRecord = allAttendance[existingId];
      await rtdb.ref(`attendance/${existingId}`).update({
        ...attendanceData,
        createdAt: existingRecord.createdAt,
      });
    } else {
      const newId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`attendance/${newId}`).set({
        ...attendanceData,
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking attendance:", error);
    return NextResponse.json({ error: "Failed to mark attendance" }, { status: 500 });
  }
}