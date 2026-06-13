import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface OverworkEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  departmentId: string;
  workDate: string;
  hours: number;
  reason: string;
  workType: string;
  attachmentUrl: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalRemark: string | null;
  convertedToLeave: boolean;
  earnedLeaveDays: number | null;
  createdAt: string;
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

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // Get user's overwork entries
    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allEntries = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};
    
    // Filter by userId - FIXED: Don't duplicate id property
    const userEntries = Object.entries(allEntries)
      .filter(([, entry]: [string, OverworkEntry]) => entry.userId === userId)
      .map(([id, entry]: [string, OverworkEntry]) => ({
        ...entry,
        id, // Add id after spreading entry (so it doesn't get overwritten)
      }))
      .sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime());

    return NextResponse.json({ entries: userEntries });
  } catch (error) {
    console.error("Error fetching overwork history:", error);
    return NextResponse.json({ error: "Failed to fetch overwork history" }, { status: 500 });
  }
}