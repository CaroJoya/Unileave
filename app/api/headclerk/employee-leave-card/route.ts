// app/api/headclerk/employee-leave-card/route.ts - WITH SUPER ADMIN SUPPORT
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { hasHeadClerkOrSuperAdminRights } from "@/lib/utils/roles";

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  employeeId?: string;
  designation?: string;
  departmentName?: string;
  mobileNumber?: string;
  phoneNumber?: string;
  doj?: string;
  dateOfJoining?: string;
  address?: string;
  bloodGroup?: string;
  pincode?: string;
  roles?: string[];
  status?: string;
}

interface LeaveRecord {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  alternateFacultyName?: string;
  createdAt: string;
  status: string;
}

interface CompOffCredit {
  id: string;
  userId: string;
  earnedDate: string;
  creditedDays: number;
  reason: string;
  status: string;
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
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const currentUserSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const currentUser = currentUserSnapshot.val();

    if (!currentUser || !hasHeadClerkOrSuperAdminRights(currentUser.roles || [])) {
      return NextResponse.json({ error: "Not authorized - Head Clerk or Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const academicYear = searchParams.get("academicYear") || getCurrentAcademicYear();

    if (!userId) {
      const usersSnapshot = await rtdb.ref("users").once("value");
      const usersMap: Record<string, UserProfile> = usersSnapshot.val() || {};
      
      const employees = Object.values(usersMap)
        .filter((u) => u.status !== "deleted")
        .map((u) => ({
          uid: u.uid,
          name: u.name,
          employeeId: u.employeeId || "PCE-" + u.uid.substring(0, 5).toUpperCase(),
          departmentName: u.departmentName || "Engineering",
          designation: u.designation || "Staff",
        }));

      return NextResponse.json({ success: true, employees });
    }

    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData: UserProfile | null = userSnapshot.val();

    if (!userData) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const balanceRef = rtdb.ref(`leaveBalances/${userId}_${academicYear}`);
    const balanceSnapshot = await balanceRef.once("value");
    const balances = balanceSnapshot.val()?.balances || {};

    const requestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests: Record<string, LeaveRecord> = requestsSnapshot.val() || {};

    const compOffSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCompOff: Record<string, CompOffCredit> = compOffSnapshot.val() || {};

    const userRequests = Object.values(allRequests).filter(
      (req) => req.applicantId === userId && req.status === "Approved"
    );

    const clRecords = userRequests.filter((r) => r.leaveType === "CL");
    const elRecords = userRequests.filter((r) => r.leaveType === "EL");
    const vacationRecords = userRequests.filter(
      (r) => r.leaveType === "VAC" || r.leaveType === "Vacation"
    );
    const coRecords = userRequests.filter(
      (r) => r.leaveType === "CO" || r.leaveType === "Comp Off"
    );
    const lwpRecords = userRequests.filter((r) => r.leaveType === "LWP");
    const mlRecords = userRequests.filter(
      (r) => r.leaveType === "ML" || r.leaveType === "SL"
    );
    const odRecords = userRequests.filter((r) => r.leaveType === "OD");

    const userCompOffCredits = Object.values(allCompOff).filter(
      (c) => c.userId === userId
    );

    return NextResponse.json({
      success: true,
      academicYear,
      employee: {
        uid: userData.uid,
        employeeId: userData.employeeId || "PCE-" + userData.uid.substring(0, 5).toUpperCase(),
        name: userData.name,
        designation: userData.designation || "Admission Counsellor",
        departmentName: userData.departmentName || "Engineering",
        mobileNumber: userData.mobileNumber || userData.phoneNumber || "9833127551",
        doj: userData.doj || userData.dateOfJoining || "16/5/2026",
        address: userData.address || "001, Shivkrupa CHS, Sec-3, New Panvel.",
        bloodGroup: userData.bloodGroup || "AB+ve",
        email: userData.email,
        pincode: userData.pincode || "410206",
      },
      balances: {
        CL: balances.CL?.available ?? 8,
        SL: balances.ML?.available ?? balances.SL?.available ?? 15,
        EL: balances.EL?.available ?? 12,
        VACATION: balances.VACATION?.available ?? 10,
        LWP: balances.LWP?.available ?? 0,
        janBalance: balances.EL?.available || 12,
        julyBalance: balances.EL?.available || 12,
      },
      vacationSlots: {
        slot1: { from: "15/05/2026", to: "15/06/2026" },
        slot2: { from: "15/11/2026", to: "15/12/2026" },
      },
      records: {
        CL: clRecords,
        EL: elRecords,
        VACATION: vacationRecords,
        CO: coRecords,
        LWP: lwpRecords,
        ML: mlRecords,
        OD: odRecords,
        compOffCredits: userCompOffCredits,
      },
    });
  } catch (error) {
    console.error("Error fetching employee leave card:", error);
    return NextResponse.json({ error: "Failed to generate leave card" }, { status: 500 });
  }
}