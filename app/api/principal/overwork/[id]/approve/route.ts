// app/api/principal/overwork/[id]/approve/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
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

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId: string;
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
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as User | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    const entrySnapshot = await rtdb.ref(`overworkEntries/${id}`).once("value");
    const entry = entrySnapshot.val() as OverworkEntry | null;

    if (!entry) {
      return NextResponse.json({ error: "Overwork entry not found" }, { status: 404 });
    }

    if (entry.status !== "pending") {
      return NextResponse.json({ error: "Overwork entry is not pending approval" }, { status: 400 });
    }

    // ✅ Get conversion config
    const configSnapshot = await rtdb.ref("overworkConfig/overwork_config").once("value");
    const config = configSnapshot.val() as OverworkConfig | null;
    const conversionHours = config?.conversionHours || 5;

    // ✅ Calculate earned leave days
    const earnedLeaveDays = Math.floor(entry.hours / conversionHours);

    // ✅ Update overwork entry
    await rtdb.ref(`overworkEntries/${id}`).update({
      status: "approved",
      approvedBy: principalId,
      approvedAt: new Date().toISOString(),
      convertedToLeave: earnedLeaveDays > 0,
      earnedLeaveDays: earnedLeaveDays > 0 ? earnedLeaveDays : null,
    });

    // ✅ CREATE COMP-OFF CREDIT if earnedLeaveDays > 0
    let creditId = null;
    if (earnedLeaveDays > 0 && config?.autoConversionEnabled !== false) {
      // ✅ Set expiry to 180 days from now
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 180);
      
      creditId = `co_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      await rtdb.ref(`compOffCredits/${creditId}`).set({
        id: creditId,
        userId: entry.userId,
        creditedDays: earnedLeaveDays,
        usedDays: 0,
        earnedDate: new Date().toISOString(),
        reason: `Auto-converted from ${entry.hours} overwork hours on ${new Date(entry.workDate).toLocaleDateString()}`,
        expiryDate: expiryDate.toISOString(),
        status: "pending_approval", // ✅ Goes to pending for Principal approval
        hoursWorked: entry.hours,
        overworkEntryId: id,
        approvedBy: null,
        approvedByName: null,
        approvalRemark: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log(`✅ Comp-off credit created: ${creditId} for ${earnedLeaveDays} days`);
    }

    // ✅ Log approval
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      overworkEntryId: id,
      actionBy: principalId,
      actionByName: principalData.name,
      actionRole: "principal",
      action: "APPROVE_OVERWORK",
      remark: null,
      oldStatus: "pending",
      newStatus: "approved",
      actionAt: new Date().toISOString(),
      compOffCreditId: creditId,
      earnedLeaveDays: earnedLeaveDays,
    });

    // ✅ Audit log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: principalId,
      userName: principalData.name,
      userRole: "principal",
      action: "OVERWORK_APPROVED",
      module: "overworkEntries",
      targetId: id,
      targetUser: entry.userId,
      details: JSON.stringify({
        hours: entry.hours,
        earnedLeaveDays,
        compOffCreditId: creditId,
      }),
      createdAt: new Date().toISOString(),
    });

    // ✅ Send notification
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: entry.userId,
      title: "Overwork Hours Approved",
      message: `Your overwork entry of ${entry.hours} hours has been approved by Principal.${earnedLeaveDays > 0 ? ` You earned ${earnedLeaveDays} comp-off day(s).` : ''}`,
      type: "overwork_approved",
      isRead: false,
      metadata: JSON.stringify({
        overworkEntryId: id,
        hours: entry.hours,
        earnedLeaveDays: earnedLeaveDays,
        compOffCreditId: creditId,
        status: creditId ? "pending_approval" : "none",
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      earnedLeaveDays,
      compOffCreditId: creditId,
    });
  } catch (error) {
    console.error("Error approving overwork:", error);
    return NextResponse.json({ error: "Failed to approve overwork" }, { status: 500 });
  }
}