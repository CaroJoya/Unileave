// app/api/headclerk/vacation-periods/[id]/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface VacationPeriod {
  id: string;
  vacationType: "Summer Vacation" | "Winter Vacation";
  year: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  paidLeaveQuota: number;
  isActive: boolean;
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as { roles?: string[]; name?: string } | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const body = await request.json();
    const { vacationType, year, startDate, endDate, paidLeaveQuota, isActive } = body;

    const vacationRef = rtdb.ref(`vacationPeriods/${id}`);
    const snapshot = await vacationRef.once("value");
    const existing = snapshot.val() as VacationPeriod | null;

    if (!existing) {
      return NextResponse.json({ error: "Vacation period not found" }, { status: 404 });
    }

    const updatedData = {
      ...existing,
      vacationType: vacationType || existing.vacationType,
      year: year || existing.year,
      startDate: startDate ? new Date(startDate).toISOString() : existing.startDate,
      endDate: endDate ? new Date(endDate).toISOString() : existing.endDate,
      paidLeaveQuota: paidLeaveQuota !== undefined ? paidLeaveQuota : existing.paidLeaveQuota,
      isActive: isActive !== undefined ? isActive : existing.isActive,
      updatedAt: new Date().toISOString(),
    };

    // Recalculate total days if dates changed
    if (startDate || endDate) {
      const start = new Date(updatedData.startDate);
      const end = new Date(updatedData.endDate);
      updatedData.totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    await vacationRef.update(updatedData);

    // Create audit log
    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: "head_clerk",
      action: "VACATION_PERIOD_UPDATED",
      module: "vacationPeriods",
      targetId: id,
      details: JSON.stringify({
        vacationType: updatedData.vacationType,
        year: updatedData.year,
        isActive: updatedData.isActive,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, vacation: updatedData });
  } catch (error) {
    console.error("Error updating vacation period:", error);
    return NextResponse.json({ error: "Failed to update vacation period" }, { status: 500 });
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as { roles?: string[]; name?: string } | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const vacationRef = rtdb.ref(`vacationPeriods/${id}`);
    const snapshot = await vacationRef.once("value");
    const existing = snapshot.val() as VacationPeriod | null;

    if (!existing) {
      return NextResponse.json({ error: "Vacation period not found" }, { status: 404 });
    }

    // Soft delete - just mark inactive
    await vacationRef.update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    // Create audit log
    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: "head_clerk",
      action: "VACATION_PERIOD_DELETED",
      module: "vacationPeriods",
      targetId: id,
      details: JSON.stringify({
        vacationType: existing.vacationType,
        year: existing.year,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating vacation period:", error);
    return NextResponse.json({ error: "Failed to deactivate vacation period" }, { status: 500 });
  }
}