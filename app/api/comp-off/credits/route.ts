// app/api/comp-off/credits/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface CompOffCredit {
  id: string;
  userId: string;
  userName: string;
  departmentId: string;
  departmentName: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: "active" | "expired" | "fully_used" | "pending_approval" | "rejected";
  approvedBy: string | null;
  approvedByName: string | null;
  approvalRemark: string | null;
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

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // Get user's comp-off credits
    const creditsSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCredits = creditsSnapshot.val() as Record<string, CompOffCredit> | null || {};

    // Filter by userId
    const userCredits = Object.entries(allCredits)
      .filter((entry) => {
        const [, credit] = entry;
        return credit.userId === userId;
      })
      .map(([id, credit]) => ({
        ...credit,
        id,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      credits: userCredits,
    });
  } catch (error) {
    console.error("Error fetching comp-off credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch comp-off credits" },
      { status: 500 }
    );
  }
}