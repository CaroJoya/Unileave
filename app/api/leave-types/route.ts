// app/api/leave-types/route.ts - COMPLETE FIXED FILE
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
  requiresEventDetails: boolean;
  maxConsecutiveDays: number | null;
  isActive: boolean;
  createdBy: string;
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

    await auth.verifySessionCookie(sessionCookie);

    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const leaveTypesData = leaveTypesSnapshot.val() as Record<string, Omit<LeaveType, 'id'>> | null || {};

    const leaveTypes: LeaveType[] = Object.entries(leaveTypesData)
      .filter(([, data]) => {
        return data && typeof data === 'object' && 'isActive' in data && data.isActive !== false;
      })
      .map(([id, data]) => ({
        id,
        ...data,
      }));

    return NextResponse.json(
      { leaveTypes },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'Vary': 'Accept-Encoding',
        },
      }
    );
  } catch (error) {
    console.error("Error fetching leave types:", error);
    return NextResponse.json(
      { error: "Failed to fetch leave types" },
      { status: 500 }
    );
  }
}