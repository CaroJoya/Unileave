// app/api/headclerk/leave-types/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val();
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const leaveTypes = leaveTypesSnapshot.val() || {};

    const leaveTypesList = Object.entries(leaveTypes).map(([id, data]) => ({
      id,
      ...(data as object),
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val();
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
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