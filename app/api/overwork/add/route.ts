// app/api/overwork/add/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
}

interface OverworkConfig {
  conversionHours: number;
  minHoursPerEntry: number;
  maxHoursPerDay: number;
  autoConversionEnabled: boolean;
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
    const userId = decodedToken.uid;

    const userSnapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { workDate, hours, reason } = body;

    if (!workDate || !hours) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const configSnapshot = await rtdb.ref("overworkConfig/overwork_config").once("value");
    const config = configSnapshot.val() as OverworkConfig | null;
    const minHours = config?.minHoursPerEntry || 0.5;
    const maxHours = config?.maxHoursPerDay || 24;

    if (hours < minHours) {
      return NextResponse.json({ error: `Minimum hours per entry is ${minHours}` }, { status: 400 });
    }
    if (hours > maxHours) {
      return NextResponse.json({ error: `Maximum hours per day is ${maxHours}` }, { status: 400 });
    }

    // Removed unused approverRole variable

    const entryId = `overwork_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const entryData = {
      id: entryId,
      userId,
      userName: userData.name,
      userRole: userData.roles[0] || "staff",
      departmentId: userData.departmentId,
      workDate: new Date(workDate).toISOString(),
      hours,
      reason: reason || "",
      workType: "holiday",
      attachmentUrl: null,
      status: "pending",
      approvedBy: null,
      approvedAt: null,
      approvalRemark: null,
      convertedToLeave: false,
      earnedLeaveDays: null,
      createdAt: new Date().toISOString(),
    };

    await rtdb.ref(`overworkEntries/${entryId}`).set(entryData);

    return NextResponse.json({ success: true, entryId });
  } catch (error) {
    console.error("Error adding overwork:", error);
    return NextResponse.json({ error: "Failed to add overwork" }, { status: 500 });
  }
}