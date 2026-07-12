// app/api/leave-types/route.ts - COMPLETE FIXED VERSION (ESLint warning fixed)
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
  collegeId?: string;
}

export async function GET() {
  try {
    const rtdb = getRTDB();
    const auth = getAuth();

    if (!rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // ✅ Get user's college from session if available
    let userCollegeId: string | null = null;
    
    try {
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("session")?.value;
      
      if (sessionCookie && auth) {
        const decodedToken = await auth.verifySessionCookie(sessionCookie);
        const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
        const userData = userSnapshot.val() as { collegeId?: string } | null;
        if (userData?.collegeId) {
          userCollegeId = userData.collegeId;
        }
      }
    } catch {
      // ✅ ESLint fix: Remove unused variable - session might not exist, that's okay
      // Session might not exist or be invalid - that's okay for public endpoints
      console.log('No valid session, returning all active leave types');
    }

    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const leaveTypesData = leaveTypesSnapshot.val() as Record<string, Omit<LeaveType, 'id'>> | null || {};

    let leaveTypes: LeaveType[] = Object.entries(leaveTypesData)
      .filter(([, data]) => {
        return data && typeof data === 'object' && 'isActive' in data && data.isActive !== false;
      })
      .map(([id, data]) => ({
        id,
        ...data,
      }));

    // ✅ Filter by college if user is authenticated
    if (userCollegeId) {
      leaveTypes = leaveTypes.filter((type) => {
        // If collegeId is set, match it; if not, treat as global or legacy
        if (type.collegeId) {
          return type.collegeId === userCollegeId;
        }
        // For backward compatibility: leave types without collegeId are 
        // included (assumed to belong to all colleges)
        return true;
      });
    }

    return NextResponse.json(
      { leaveTypes },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'Vary': 'Accept-Encoding, Cookie',
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