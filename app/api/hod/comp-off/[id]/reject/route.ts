// app/api/hod/comp-off/[id]/reject/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getCompOffRejectedEmail } from "@/lib/utils/email";

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

    const creditSnapshot = await rtdb.ref(`compOffCredits/${id}`).once("value");
    const credit = creditSnapshot.val();

    if (!credit) {
      return NextResponse.json({ error: "Comp-off credit not found" }, { status: 404 });
    }

    const userSnapshot = await rtdb.ref(`users/${credit.userId}`).once("value");
    const userData = userSnapshot.val();

    if (!userData || userData.departmentId !== hodData.departmentId) {
      return NextResponse.json({ error: "Not authorized for this user" }, { status: 403 });
    }

    await rtdb.ref(`compOffCredits/${id}`).update({
      status: "rejected",
      updatedAt: new Date().toISOString(),
    });

    // Create notification
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: credit.userId,
      title: "Comp-Off Request Rejected",
      message: `Your comp-off request has been rejected by HOD.`,
      type: "comp_off_rejected",
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    // Send email
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