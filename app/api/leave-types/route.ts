// app/api/leave-types/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

// Define the shape of a leave type
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Just verify the user is logged in (no role check)
    await auth.verifySessionCookie(sessionCookie);

    // Get all leave types
    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const leaveTypesData = leaveTypesSnapshot.val() as Record<string, Omit<LeaveType, 'id'>> | null || {};

    // Convert to array with proper typing
    const leaveTypes: LeaveType[] = Object.entries(leaveTypesData)
      .filter(([, data]) => {
        // Type guard to ensure data has isActive property
        return data && typeof data === 'object' && 'isActive' in data && data.isActive !== false;
      })
      .map(([id, data]) => ({
        id,
        ...data,
      }));

    // 🆕 Add cache headers for better performance
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