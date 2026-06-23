// app/api/comp-off/usage-history/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface CompOffUsage {
  id: string;
  creditId: string;
  leaveRequestId: string;
  userId: string;
  userName: string;
  daysUsed: number;
  usedAt: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

interface CompOffCredit {
  creditedDays: number;
  earnedDate: string;
  reason: string;
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

    // Get all comp-off usage records
    const usageSnapshot = await rtdb.ref("compOffUsage").once("value");
    const allUsage = usageSnapshot.val() as Record<string, CompOffUsage> | null || {};

    // Filter by userId
    const userUsage = Object.entries(allUsage)
      .filter((entry) => {
        const [, usage] = entry;
        return usage.userId === userId;
      })
      .map(([id, usage]) => ({
        ...usage,
        id,
      }))
      .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime());

    // Get credit details for each usage
    const usageWithDetails = await Promise.all(
      userUsage.map(async (usage) => {
        try {
          // Use non-null assertion since we already checked rtdb is not null
          const creditSnapshot = await rtdb!.ref(`compOffCredits/${usage.creditId}`).once("value");
          const credit = creditSnapshot.val() as CompOffCredit | null;
          return {
            ...usage,
            creditDetails: credit
              ? {
                  creditedDays: credit.creditedDays,
                  earnedDate: credit.earnedDate,
                  reason: credit.reason,
                }
              : null,
          };
        } catch (error) {
          console.error(`Error fetching credit ${usage.creditId}:`, error);
          return {
            ...usage,
            creditDetails: null,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      usage: usageWithDetails,
    });
  } catch (error) {
    console.error("Error fetching comp-off usage history:", error);
    return NextResponse.json(
      { error: "Failed to fetch comp-off usage history" },
      { status: 500 }
    );
  }
}