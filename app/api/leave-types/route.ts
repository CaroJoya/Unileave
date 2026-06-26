// app/api/leave-types/route.ts - FIXED (Public endpoint)
import { NextResponse } from "next/server";
import { getRTDB } from "@/lib/firebase/admin";

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
    const rtdb = getRTDB();

    if (!rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

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