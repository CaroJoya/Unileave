// app/api/cron/expire-comp-off/route.ts - COMPLETE FIXED VERSION
// This is a Vercel Cron Job that runs daily at midnight
import { NextResponse } from "next/server";
import { getRTDB } from "@/lib/firebase/admin";

interface CompOffCredit {
  id: string;
  userId: string;
  creditedDays: number;
  usedDays: number;
  status: string;
  expiryDate: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

// Vercel Cron Job - runs daily at 00:00 UTC
export async function GET(request: Request) {
  // Verify it's a cron request (optional: add secret verification)
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🔄 Running comp-off credit expiry job...");
    
    const rtdb = getRTDB();
    if (!rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const creditsSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCredits = creditsSnapshot.val() as Record<string, CompOffCredit> | null || {};
    
    const now = new Date();
    let expiredCount = 0;
    const expiredIds: string[] = [];
    const errors: string[] = [];

    for (const [id, credit] of Object.entries(allCredits)) {
      // ✅ Check if credit is active or pending_approval and has expired
      const isActive = credit.status === "active" || credit.status === "pending_approval";
      const isExpired = new Date(credit.expiryDate) < now;
      
      if (isActive && isExpired) {
        try {
          await rtdb.ref(`compOffCredits/${id}`).update({
            status: "expired",
            expiredAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
          expiredCount++;
          expiredIds.push(id);
          console.log(`✅ Expired credit: ${id} (User: ${credit.userId}, Days: ${credit.creditedDays})`);
        } catch (error) {
          const errorMsg = `Failed to expire credit ${id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`✅ Comp-off expiry job completed: ${expiredCount} credits expired`);
    
    // ✅ Log the job execution
    const logId = `cron_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${logId}`).set({
      id: logId,
      userId: "system",
      userName: "Cron Job",
      userRole: "system",
      action: "COMP_OFF_EXPIRY_JOB",
      module: "compOffCredits",
      details: JSON.stringify({
        expiredCount,
        expiredIds,
        errors,
        timestamp: now.toISOString(),
      }),
      createdAt: now.toISOString(),
    });

    return NextResponse.json({
      success: true,
      expired: expiredCount,
      expiredIds,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Comp-off expiry job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}