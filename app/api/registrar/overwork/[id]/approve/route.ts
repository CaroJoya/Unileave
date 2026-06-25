// app/api/registrar/overwork/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface OverworkEntry {
  id: string;
  userId: string;
  userName: string;
  departmentId: string;
  hours: number;
  workDate: string;
  status: string;
}

interface OverworkConfig {
  conversionHours: number;
  autoConversionEnabled: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val();

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized - Registrar only" }, { status: 403 });
    }

    // Get overwork entry
    const entrySnapshot = await rtdb.ref(`overworkEntries/${id}`).once("value");
    const entry = entrySnapshot.val() as OverworkEntry | null;

    if (!entry) {
      return NextResponse.json({ error: "Overwork entry not found" }, { status: 404 });
    }

    if (entry.status !== "pending") {
      return NextResponse.json({ error: "Overwork entry is not pending approval" }, { status: 400 });
    }

    // Get overwork config
    const configSnapshot = await rtdb.ref("overworkConfig/overwork_config").once("value");
    const config = configSnapshot.val() as OverworkConfig | null;
    const conversionHours = config?.conversionHours || 5;

    // Calculate earned leave days
    const earnedLeaveDays = Math.floor(entry.hours / conversionHours);

    // Update overwork entry
    await rtdb.ref(`overworkEntries/${id}`).update({
      status: "approved",
      approvedBy: registrarId,
      approvedAt: new Date().toISOString(),
      convertedToLeave: earnedLeaveDays > 0,
      earnedLeaveDays: earnedLeaveDays > 0 ? earnedLeaveDays : null,
      updatedAt: new Date().toISOString(),
    });

    // Create comp-off credits if earned
    if (earnedLeaveDays > 0 && config?.autoConversionEnabled !== false) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      const creditId = `co_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await rtdb.ref(`compOffCredits/${creditId}`).set({
        id: creditId,
        userId: entry.userId,
        creditedDays: earnedLeaveDays,
        usedDays: 0,
        earnedDate: new Date().toISOString(),
        reason: `Auto-converted from ${entry.hours} overwork hours on ${new Date(entry.workDate).toLocaleDateString()}`,
        expiryDate: expiryDate.toISOString(),
        status: "active",
        createdAt: new Date().toISOString(),
      });
    }

    // Create approval log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      overworkEntryId: id,
      actionBy: registrarId,
      actionByName: registrarData.name,
      actionRole: "registrar",
      action: "APPROVE_OVERWORK",
      remark: null,
      oldStatus: "pending",
      newStatus: "approved",
      actionAt: new Date().toISOString(),
    });

    // Create audit log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: registrarId,
      userName: registrarData.name,
      userRole: "registrar",
      action: "OVERWORK_APPROVED",
      module: "overworkEntries",
      targetId: id,
      targetUser: entry.userId,
      details: JSON.stringify({
        hours: entry.hours,
        earnedLeaveDays,
      }),
      createdAt: new Date().toISOString(),
    });

    // Create notification
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: entry.userId,
      title: "Overwork Hours Approved",
      message: `Your overwork entry of ${entry.hours} hours has been approved by Registrar.${earnedLeaveDays > 0 ? ` You earned ${earnedLeaveDays} comp-off day(s).` : ''}`,
      type: "overwork_approved",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, earnedLeaveDays });
  } catch (error) {
    console.error("Error approving overwork:", error);
    return NextResponse.json({ error: "Failed to approve overwork" }, { status: 500 });
  }
}