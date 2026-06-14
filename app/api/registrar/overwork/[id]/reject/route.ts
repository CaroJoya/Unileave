// app/api/registrar/overwork/[id]/reject/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getOverworkRejectedEmail } from "@/lib/utils/email";

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

    const entrySnapshot = await rtdb.ref(`overworkEntries/${id}`).once("value");
    const entry = entrySnapshot.val();

    if (!entry) {
      return NextResponse.json({ error: "Overwork entry not found" }, { status: 404 });
    }

    await rtdb.ref(`overworkEntries/${id}`).update({
      status: "rejected",
      approvedBy: registrarId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create audit log
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: registrarId,
      userName: registrarData.name,
      userRole: "registrar",
      action: "OVERWORK_REJECTED",
      module: "overworkEntries",
      targetId: id,
      targetUser: entry.userId,
      createdAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: entry.userId,
      title: "Overwork Request Rejected",
      message: `Your overwork request has been rejected by Registrar.`,
      type: "overwork_rejected",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    // Send email
    const userSnapshot = await rtdb.ref(`users/${entry.userId}`).once("value");
    const userData = userSnapshot.val();

    if (userData?.email) {
      await sendEmail({
        to: userData.email,
        subject: "Overwork Request Rejected",
        html: getOverworkRejectedEmail(entry.userName, entry.hours),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting overwork:", error);
    return NextResponse.json({ error: "Failed to reject overwork" }, { status: 500 });
  }
}