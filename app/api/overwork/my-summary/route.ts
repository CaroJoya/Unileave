// app/api/overwork/my-summary/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface OverworkEntry {
  id: string;
  userId: string;
  hours: number;
  status: string;
  convertedToLeave: boolean;
}

interface OverworkConfig {
  conversionHours: number;
  minHoursPerEntry: number;
  maxHoursPerDay: number;
  autoConversionEnabled: boolean;
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
    const userId = decodedToken.uid;

    const configSnapshot = await rtdb.ref("overworkConfig/overwork_config").once("value");
    const config = configSnapshot.val() as OverworkConfig | null;
    const conversionHours = config?.conversionHours || 5;

    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allEntries = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};
    
    let totalApprovedHours = 0;
    let pendingHours = 0;
    let rejectedHours = 0;

    for (const entry of Object.values(allEntries)) {
      if (entry.userId === userId) {
        if (entry.status === "approved") {
          totalApprovedHours += entry.hours;
        } else if (entry.status === "pending") {
          pendingHours += entry.hours;
        } else if (entry.status === "rejected") {
          rejectedHours += entry.hours;
        }
      }
    }

    const earnedLeaves = Math.floor(totalApprovedHours / conversionHours);
    const remainingHoursForNext = conversionHours - (totalApprovedHours % conversionHours);
    const progressPercent = (totalApprovedHours % conversionHours) / conversionHours * 100;

    return NextResponse.json({
      summary: {
        totalApprovedHours,
        pendingHours,
        rejectedHours,
        earnedLeaves,
        remainingHoursForNext,
        progressPercent,
        conversionRate: conversionHours,
      },
    });
  } catch (error) {
    console.error("Error fetching overwork summary:", error);
    return NextResponse.json({ error: "Failed to fetch overwork summary" }, { status: 500 });
  }
}