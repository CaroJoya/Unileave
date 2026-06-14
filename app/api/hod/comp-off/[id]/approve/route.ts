// app/api/hod/comp-off/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getCompOffApprovedEmail } from "@/lib/utils/email";

interface CompOffCredit {
  id: string;
  userId: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: string;
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
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val();

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized - HOD only" }, { status: 403 });
    }

    // Get comp-off credit
    const creditSnapshot = await rtdb.ref(`compOffCredits/${id}`).once("value");
    const credit = creditSnapshot.val() as CompOffCredit | null;

    if (!credit) {
      return NextResponse.json({ error: "Comp-off credit not found" }, { status: 404 });
    }

    // Get user to verify department
    const userSnapshot = await rtdb.ref(`users/${credit.userId}`).once("value");
    const userData = userSnapshot.val();

    if (!userData || userData.departmentId !== hodData.departmentId) {
      return NextResponse.json({ error: "Not authorized for this user" }, { status: 403 });
    }

    if (credit.status !== "pending_approval") {
      return NextResponse.json({ error: "Comp-off is not pending approval" }, { status: 400 });
    }

    // Update comp-off credit status to active
    await rtdb.ref(`compOffCredits/${id}`).update({
      status: "active",
      updatedAt: new Date().toISOString(),
    });

    // Create approval log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      compOffId: id,
      actionBy: hodId,
      actionByName: hodData.name,
      actionRole: "hod",
      action: "APPROVE_COMP_OFF",
      remark: null,
      oldStatus: "pending_approval",
      newStatus: "active",
      actionAt: new Date().toISOString(),
    });

    // Create notification
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: credit.userId,
      title: "Comp-Off Credit Approved",
      message: `Your comp-off credit of ${credit.creditedDays} day(s) has been approved.`,
      type: "comp_off_approved",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    // Send email
    if (userData?.email) {
      await sendEmail({
        to: userData.email,
        subject: "Comp-Off Credit Approved",
        html: getCompOffApprovedEmail(
          userData.name,
          credit.creditedDays,
          credit.expiryDate
        ),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving comp-off:", error);
    return NextResponse.json({ error: "Failed to approve comp-off" }, { status: 500 });
  }
}