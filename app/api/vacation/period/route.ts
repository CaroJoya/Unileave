// app/api/vacation/periods/route.ts
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

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Verify user is authenticated (but no role check needed)
    await auth.verifySessionCookie(sessionCookie);

    const vacationsSnapshot = await rtdb.ref("vacationPeriods").once("value");
    const vacationsData = vacationsSnapshot.val() as Record<string, VacationPeriod> | null || {};

    const vacationsList = Object.entries(vacationsData)
      .map(([id, data]) => ({
        ...data,
        id,
      }))
      .filter((v) => v.isActive === true)
      .sort((a, b) => a.year - b.year);

    return NextResponse.json({ vacations: vacationsList });
  } catch (error) {
    console.error("Error fetching vacation periods:", error);
    return NextResponse.json({ error: "Failed to fetch vacation periods" }, { status: 500 });
  }
}