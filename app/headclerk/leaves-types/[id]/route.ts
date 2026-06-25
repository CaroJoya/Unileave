// app/headclerk/leaves-types/[id]/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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
    const userData = userSnapshot.val();
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
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
    const existing = snapshot.val();

    if (!existing) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
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
      updatedAt: new Date().toISOString(),
    };

    await leaveTypeRef.update(updatedData);

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
    const userData = userSnapshot.val();
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const leaveTypeRef = rtdb.ref(`leaveTypes/${id}`);
    const snapshot = await leaveTypeRef.once("value");
    const existing = snapshot.val();

    if (!existing) {
      return NextResponse.json({ error: "Leave type not found" }, { status: 404 });
    }

    await leaveTypeRef.update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating leave type:", error);
    return NextResponse.json({ error: "Failed to deactivate leave type" }, { status: 500 });
  }
}