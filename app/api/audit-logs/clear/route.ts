// app/api/audit-logs/clear/route.ts - NEW COMPLETE FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { createAuditLog } from "@/lib/services/audit-service";

export async function DELETE(request: Request) {
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
    const userData = userSnapshot.val() as { roles?: string[]; name?: string } | null;
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized - Super Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const olderThan = searchParams.get("olderThan") || "all";
    
    let logsToDelete: string[] = [];
    const logsSnapshot = await rtdb.ref("auditLogs").once("value");
    const allLogs = logsSnapshot.val() as Record<string, { createdAt: string }> | null || {};
    
    if (olderThan === "all") {
      // Delete all logs
      await rtdb.ref("auditLogs").remove();
      logsToDelete = Object.keys(allLogs);
    } else {
      // Delete logs older than X days
      const days = parseInt(olderThan, 10);
      if (isNaN(days) || days <= 0) {
        return NextResponse.json({ error: "Invalid days parameter" }, { status: 400 });
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const toDelete: string[] = [];
      for (const [id, log] of Object.entries(allLogs)) {
        if (log.createdAt && new Date(log.createdAt) < cutoffDate) {
          toDelete.push(id);
        }
      }
      
      // Delete in batches
      for (const id of toDelete) {
        await rtdb.ref(`auditLogs/${id}`).remove();
      }
      
      logsToDelete = toDelete;
    }

    // Log the clearance (this log survives because it's created after deletion)
    await createAuditLog({
      userId: decodedToken.uid,
      userName: userData.name || "Super Admin",
      userRole: "super_admin",
      action: "AUDIT_LOGS_CLEARED",
      module: "auditLogs",
      details: {
        deletedCount: logsToDelete.length,
        olderThan: olderThan === "all" ? "all" : `${olderThan} days`,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: logsToDelete.length,
      message: `Cleared ${logsToDelete.length} audit log(s)`,
    });
  } catch (error) {
    console.error("Error clearing audit logs:", error);
    return NextResponse.json(
      { error: "Failed to clear audit logs" },
      { status: 500 }
    );
  }
}