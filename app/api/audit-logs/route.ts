// app/api/audit-logs/route.ts - ALREADY EXISTS
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getAuditLogs } from "@/lib/services/audit-service";
import type { AuditAction, AuditModule } from "@/lib/services/audit-service";

export async function GET(request: Request) {
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
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as { roles?: string[] } | null;
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized - Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const actionParam = searchParams.get("action") as AuditAction | undefined;
    const moduleParam = searchParams.get("module") as AuditModule | undefined;
    const userId = searchParams.get("userId") || undefined;
    const limit = parseInt(searchParams.get("limit") || "100");

    const logs = await getAuditLogs({
      startDate,
      endDate,
      action: actionParam,
      module: moduleParam,
      userId,
      limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}