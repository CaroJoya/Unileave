// app/api/headclerk/leave-types/[id]/route.ts - COMPLETE FIXED FILE WITH COLLEGE ISOLATION
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

interface UserData {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId: string;
  collegeName: string;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const userData = userSnapshot.val() as UserData | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // ✅ Get the Head Clerk's college ID
    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { 
      leaveName, 
      description, 
      allowHalfDay, 
      requiresAttachment, 
      deductsBalance,
      hasExpiry,
      expiryInDays,
      maxConsecutiveDays,
      isActive 
    } = body;

    const leaveTypeRef = rtdb.ref(`leaveTypes/${id}`);
    const snapshot = await leaveTypeRef.once("value");
    const existing = snapshot.val() as LeaveType | null;

    if (!existing) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
    }

    // ✅ Verify leave type belongs to this college
    if (existing.collegeId && existing.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "You are not authorized to modify leave types from other colleges" 
      }, { status: 403 });
    }

    const updatedData = {
      ...existing,
      leaveName: leaveName || existing.leaveName,
      description: description !== undefined ? description : existing.description,
      allowHalfDay: allowHalfDay !== undefined ? allowHalfDay : existing.allowHalfDay,
      requiresAttachment: requiresAttachment !== undefined ? requiresAttachment : existing.requiresAttachment,
      deductsBalance: deductsBalance !== undefined ? deductsBalance : existing.deductsBalance,
      hasExpiry: hasExpiry !== undefined ? hasExpiry : existing.hasExpiry,
      expiryInDays: expiryInDays !== undefined ? expiryInDays : existing.expiryInDays,
      maxConsecutiveDays: maxConsecutiveDays !== undefined ? maxConsecutiveDays : existing.maxConsecutiveDays,
      isActive: isActive !== undefined ? isActive : existing.isActive,
      collegeId: collegeId, // ✅ Ensure collegeId is set
      updatedAt: new Date().toISOString(),
    };

    await leaveTypeRef.update(updatedData);

    // ✅ Log the action with college ID
    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: "head_clerk",
      action: "LEAVE_TYPE_UPDATED",
      module: "leaveTypes",
      targetId: id,
      details: JSON.stringify({
        leaveCode: existing.leaveCode,
        leaveName: updatedData.leaveName,
        isActive: updatedData.isActive,
        collegeId: collegeId,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, leaveType: updatedData });
  } catch (error) {
    console.error("Error updating leave type:", error);
    return NextResponse.json({ error: "Failed to update leave type" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const userData = userSnapshot.val() as UserData | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // ✅ Get the Head Clerk's college ID
    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const leaveTypeRef = rtdb.ref(`leaveTypes/${id}`);
    const snapshot = await leaveTypeRef.once("value");
    const existing = snapshot.val() as LeaveType | null;

    if (!existing) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
    }

    // ✅ Verify leave type belongs to this college
    if (existing.collegeId && existing.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "You are not authorized to modify leave types from other colleges" 
      }, { status: 403 });
    }

    // Soft delete (deactivate) instead of hard delete
    await leaveTypeRef.update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    // ✅ Log the action with college ID
    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: "head_clerk",
      action: "LEAVE_TYPE_DELETED",
      module: "leaveTypes",
      targetId: id,
      details: JSON.stringify({
        leaveCode: existing.leaveCode,
        leaveName: existing.leaveName,
        collegeId: collegeId,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating leave type:", error);
    return NextResponse.json({ error: "Failed to deactivate leave type" }, { status: 500 });
  }
}