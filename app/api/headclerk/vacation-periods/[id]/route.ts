// app/api/headclerk/vacation-periods/[id]/route.ts - WITH SUPER ADMIN SUPPORT
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { hasHeadClerkOrSuperAdminRights, getPerformerRole } from "@/lib/utils/roles";

interface VacationPeriod {
  id: string;
  vacationType: "Summer Vacation" | "Winter Vacation";
  year: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  paidLeaveQuota: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  collegeId: string;
}

interface UserRecord {
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
    const userData = userSnapshot.val() as UserRecord | null;
    
    if (!userData || !hasHeadClerkOrSuperAdminRights(userData.roles || [])) {
      return NextResponse.json({ error: "Not authorized - Head Clerk or Super Admin only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "User has no college assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { startDate, endDate, paidLeaveQuota, isActive } = body;

    const vacationRef = rtdb.ref(`vacationPeriods/${id}`);
    const snapshot = await vacationRef.once("value");
    const existing = snapshot.val() as VacationPeriod | null;

    if (!existing) {
      return NextResponse.json({ error: "Vacation period not found" }, { status: 404 });
    }

    if (existing.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "You are not authorized to modify vacation periods from other colleges" 
      }, { status: 403 });
    }

    const updateData: Partial<VacationPeriod> = {
      updatedAt: new Date().toISOString(),
    };

    if (startDate) {
      const start = new Date(startDate);
      const end = new Date(endDate || existing.endDate);
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (totalDays !== 40) {
        return NextResponse.json({ error: "Vacation period must be exactly 40 days" }, { status: 400 });
      }
      
      updateData.startDate = new Date(startDate).toISOString();
      updateData.totalDays = totalDays;
    }

    if (endDate) {
      const start = new Date(startDate || existing.startDate);
      const end = new Date(endDate);
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (totalDays !== 40) {
        return NextResponse.json({ error: "Vacation period must be exactly 40 days" }, { status: 400 });
      }
      
      updateData.endDate = new Date(endDate).toISOString();
      updateData.totalDays = totalDays;
    }

    if (paidLeaveQuota !== undefined) {
      const maxQuota = existing.vacationType === "Summer Vacation" ? 27 : 21;
      if (paidLeaveQuota > maxQuota) {
        return NextResponse.json({ 
          error: `Paid leave quota cannot exceed ${maxQuota} for ${existing.vacationType}` 
        }, { status: 400 });
      }
      updateData.paidLeaveQuota = paidLeaveQuota;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    await vacationRef.update(updateData);

    const performerRole = getPerformerRole(userData.roles || []);
    
    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: performerRole,
      action: "VACATION_PERIOD_UPDATED",
      module: "vacationPeriods",
      targetId: id,
      details: JSON.stringify({
        vacationType: existing.vacationType,
        year: existing.year,
        updates: updateData,
        collegeId,
        performedBy: performerRole,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
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
    
    if (!userData || !hasHeadClerkOrSuperAdminRights(userData.roles || [])) {
      return NextResponse.json({ error: "Not authorized - Head Clerk or Super Admin only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "User has no college assigned" }, { status: 400 });
    }

    const vacationRef = rtdb.ref(`vacationPeriods/${id}`);
    const snapshot = await vacationRef.once("value");
    const existing = snapshot.val() as VacationPeriod | null;

    if (!existing) {
      return NextResponse.json({ error: "Vacation period not found" }, { status: 404 });
    }

    if (existing.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "You are not authorized to modify vacation periods from other colleges" 
      }, { status: 403 });
    }

    await vacationRef.update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    });

    const performerRole = getPerformerRole(userData.roles || []);
    
    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: performerRole,
      action: "VACATION_PERIOD_DELETED",
      module: "vacationPeriods",
      targetId: id,
      details: JSON.stringify({
        vacationType: existing.vacationType,
        year: existing.year,
        collegeId,
        action: "Soft deleted (deactivated)",
        performedBy: performerRole,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deactivating vacation period:", error);
    return NextResponse.json({ error: "Failed to deactivate vacation period" }, { status: 500 });
  }
}