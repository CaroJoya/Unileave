// app/api/headclerk/vacation-periods/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
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
  createdAt: string;
  updatedAt: string;
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
    const userData = userSnapshot.val() as { roles?: string[] } | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const vacationsSnapshot = await rtdb.ref("vacationPeriods").once("value");
    const vacationsData = vacationsSnapshot.val() as Record<string, VacationPeriod> | null || {};

    const vacationsList = Object.entries(vacationsData).map(([id, data]) => ({
      ...data,
      id,
    }));

    return NextResponse.json({ vacations: vacationsList });
  } catch (error) {
    console.error("Error fetching vacation periods:", error);
    return NextResponse.json({ error: "Failed to fetch vacation periods" }, { status: 500 });
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
    const userData = userSnapshot.val() as { roles?: string[]; name?: string } | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const body = await request.json();
    const { vacationType, year, startDate, endDate, paidLeaveQuota } = body;

    if (!vacationType || !year || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (totalDays !== 40) {
      return NextResponse.json({ error: "Vacation period must be exactly 40 days" }, { status: 400 });
    }

    const maxQuota = vacationType === "Summer Vacation" ? 27 : 21;
    if (paidLeaveQuota > maxQuota) {
      return NextResponse.json({ 
        error: `Paid leave quota cannot exceed ${maxQuota} for ${vacationType}` 
      }, { status: 400 });
    }

    const vacationsSnapshot = await rtdb.ref("vacationPeriods").once("value");
    const existingVacations = vacationsSnapshot.val() as Record<string, VacationPeriod> | null || {};
    
    for (const [, vacation] of Object.entries(existingVacations)) {
      if (vacation.vacationType === vacationType && vacation.year === year && vacation.isActive) {
        return NextResponse.json({ 
          error: `An active ${vacationType} for ${year} already exists. Deactivate it first.` 
        }, { status: 400 });
      }
    }

    const vacationId = `vac_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const vacationData: VacationPeriod = {
      id: vacationId,
      vacationType,
      year,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      totalDays,
      paidLeaveQuota: paidLeaveQuota || maxQuota,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await rtdb.ref(`vacationPeriods/${vacationId}`).set(vacationData);

    const auditLog = {
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: "head_clerk",
      action: "VACATION_PERIOD_CREATED",
      module: "vacationPeriods",
      targetId: vacationId,
      details: JSON.stringify({
        vacationType,
        year,
        totalDays,
        paidLeaveQuota,
      }),
      createdAt: new Date().toISOString(),
    };
    await rtdb.ref("auditLogs").push(auditLog);

    return NextResponse.json({ 
      success: true, 
      vacation: vacationData 
    });
  } catch (error) {
    console.error("Error creating vacation period:", error);
    return NextResponse.json({ error: "Failed to create vacation period" }, { status: 500 });
  }
}