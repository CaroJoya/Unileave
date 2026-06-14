// app/api/principal/comp-off/[id]/reject/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getCompOffRejectedEmail } from "@/lib/utils/email";

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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as User | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    const creditSnapshot = await rtdb.ref(`compOffCredits/${id}`).once("value");
    const credit = creditSnapshot.val();

    if (!credit) {
      return NextResponse.json({ error: "Comp-off credit not found" }, { status: 404 });
    }

    await rtdb.ref(`compOffCredits/${id}`).update({
      status: "rejected",
      updatedAt: new Date().toISOString(),
    });

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: principalId,
      userName: principalData.name,
      userRole: "principal",
      action: "COMP_OFF_REJECTED",
      module: "compOffCredits",
      targetId: id,
      targetUser: credit.userId,
      createdAt: new Date().toISOString(),
    });

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: credit.userId,
      title: "Comp-Off Request Rejected",
      message: `Your comp-off request has been rejected by Principal.`,
      type: "comp_off_rejected",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    const userSnapshot = await rtdb.ref(`users/${credit.userId}`).once("value");
    const userData = userSnapshot.val();

    if (userData?.email) {
      await sendEmail({
        to: userData.email,
        subject: "Comp-Off Request Rejected",
        html: getCompOffRejectedEmail(userData.name),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting comp-off:", error);
    return NextResponse.json({ error: "Failed to reject comp-off" }, { status: 500 });
  }
}