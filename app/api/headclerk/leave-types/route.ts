// app/api/headclerk/leave-types/route.ts - FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface LeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  description: string;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  deductsBalance: boolean;
  hasExpiry: boolean;
  expiryInDays: number | null;
  maxConsecutiveDays: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  collegeId?: string;
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId: string;
  collegeName: string;
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
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const leaveTypes = leaveTypesSnapshot.val() as Record<string, LeaveType> | null || {};

    // ✅ FIXED: Don't use spread with id - use explicit mapping
    const leaveTypesList = Object.entries(leaveTypes)
      .filter(([, data]) => {
        if (data.collegeId) {
          return data.collegeId === collegeId;
        }
        return data.collegeId === undefined || data.collegeId === collegeId;
      })
      .map(([id, data]) => ({
        id, // ✅ Explicitly set id first
        leaveCode: data.leaveCode,
        leaveName: data.leaveName,
        description: data.description,
        allowHalfDay: data.allowHalfDay,
        requiresAttachment: data.requiresAttachment,
        deductsBalance: data.deductsBalance,
        hasExpiry: data.hasExpiry,
        expiryInDays: data.expiryInDays,
        maxConsecutiveDays: data.maxConsecutiveDays,
        isActive: data.isActive,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        collegeId: data.collegeId,
      }));

    return NextResponse.json({ leaveTypes: leaveTypesList });
  } catch (error) {
    console.error("Error fetching leave types:", error);
    return NextResponse.json({ error: "Failed to fetch leave types" }, { status: 500 });
  }
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
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { 
      leaveCode, 
      leaveName, 
      description, 
      allowHalfDay, 
      requiresAttachment, 
      deductsBalance,
      hasExpiry,
      expiryInDays,
      maxConsecutiveDays 
    } = body;

    if (!leaveCode || !leaveName) {
      return NextResponse.json({ error: "Leave code and name are required" }, { status: 400 });
    }

    const leaveTypeId = `leave_${leaveCode.toLowerCase()}_${Date.now()}`;
    const leaveTypeData = {
      id: leaveTypeId,
      leaveCode: leaveCode.toUpperCase(),
      leaveName,
      description: description || "",
      allowHalfDay: allowHalfDay || false,
      requiresAttachment: requiresAttachment || false,
      deductsBalance: deductsBalance !== false,
      hasExpiry: hasExpiry || false,
      expiryInDays: expiryInDays || null,
      maxConsecutiveDays: maxConsecutiveDays || null,
      isActive: true,
      collegeId: collegeId,
      createdBy: decodedToken.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await rtdb.ref(`leaveTypes/${leaveTypeId}`).set(leaveTypeData);

    return NextResponse.json({ success: true, leaveType: leaveTypeData });
  } catch (error) {
    console.error("Error creating leave type:", error);
    return NextResponse.json({ error: "Failed to create leave type" }, { status: 500 });
  }
}