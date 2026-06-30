// app/api/cron/expire-comp-off/route.ts - NEW FILE
// This is a Vercel Cron Job that runs daily at midnight
import { NextResponse } from "next/server";
import { expireCompOffCredits } from "@/lib/services/comp-off-service";

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
    const result = await expireCompOffCredits();
    
    console.log(`✅ Comp-off expiry job completed: ${result.expired} credits expired`);
    
    return NextResponse.json({
      success: true,
      expired: result.expired,
      errors: result.errors,
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