// app/api/principal/comp-off/[id]/approve/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
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

    const creditSnapshot = await rtdb.ref(`compOffCredits/${id}`).once("value");
    const credit = creditSnapshot.val() as CompOffCredit | null;

    if (!credit) {
      return NextResponse.json({ error: "Comp-off credit not found" }, { status: 404 });
    }

    if (credit.status !== "pending_approval") {
      return NextResponse.json({ error: "Comp-off is not pending approval" }, { status: 400 });
    }

    await rtdb.ref(`compOffCredits/${id}`).update({
      status: "active",
      updatedAt: new Date().toISOString(),
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      compOffId: id,
      actionBy: principalId,
      actionByName: principalData.name,
      actionRole: "principal",
      action: "APPROVE_COMP_OFF",
      remark: null,
      oldStatus: "pending_approval",
      newStatus: "active",
      actionAt: new Date().toISOString(),
    });

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: principalId,
      userName: principalData.name,
      userRole: "principal",
      action: "COMP_OFF_APPROVED",
      module: "compOffCredits",
      targetId: id,
      targetUser: credit.userId,
      details: { creditedDays: credit.creditedDays },
      createdAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: credit.userId,
      title: "Comp-Off Credit Approved",
      message: `Your comp-off credit of ${credit.creditedDays} day(s) has been approved by Principal.`,
      type: "comp_off_approved",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const userSnapshot = await rtdb.ref(`users/${credit.userId}`).once("value");
    const userData = userSnapshot.val() as User | null;

    if (userData?.email) {
      await sendEmail({
        to: userData.email,
        subject: "Comp-Off Credit Approved",
        html: getCompOffApprovedEmail(userData.name, credit.creditedDays, credit.expiryDate),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving comp-off:", error);
    return NextResponse.json({ error: "Failed to approve comp-off" }, { status: 500 });
  }
}