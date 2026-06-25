// app/api/hod/comp-off/[id]/reject/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getCompOffRejectedEmail } from "@/lib/utils/email";

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

interface UserData {
  name: string;
  email: string;
  departmentId: string;
  roles?: string[];
}

interface HodData {
  name: string;
  roles: string[];
  departmentId: string;
}

interface LeaveRequest {
  id: string;
  applicantId: string;
  status: string;
  compOffCreditsUsed?: {
    creditId: string;
    daysUsed: number;
  };
}

interface CompOffUsage {
  id: string;
  creditId: string;
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
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as HodData | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized - HOD only" }, { status: 403 });
    }

    const creditSnapshot = await rtdb.ref(`compOffCredits/${id}`).once("value");
    const credit = creditSnapshot.val() as CompOffCredit | null;

    if (!credit) {
      return NextResponse.json({ error: "Comp-off credit not found" }, { status: 404 });
    }

    const userSnapshot = await rtdb.ref(`users/${credit.userId}`).once("value");
    const userData = userSnapshot.val() as UserData | null;

    if (!userData || userData.departmentId !== hodData.departmentId) {
      return NextResponse.json({ error: "Not authorized for this user" }, { status: 403 });
    }

    await rtdb.ref(`compOffCredits/${id}`).update({
      status: "rejected",
      updatedAt: new Date().toISOString(),
    });

    const leaveRequestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const leaveRequests = leaveRequestsSnapshot.val() as Record<string, LeaveRequest> | null || {};
    let associatedRequestId: string | null = null;
    let associatedRequest: LeaveRequest | null = null;

    for (const [reqId, req] of Object.entries(leaveRequests)) {
      if (req.compOffCreditsUsed?.creditId === id) {
        associatedRequestId = reqId;
        associatedRequest = req;
        break;
      }
    }

    if (associatedRequestId && associatedRequest) {
      await rtdb.ref(`leaveRequests/${associatedRequestId}`).update({
        status: "Rejected_HOD",
        updatedAt: new Date().toISOString(),
      });
    }

    const usageSnapshot = await rtdb.ref("compOffUsage").once("value");
    const usageRecords = usageSnapshot.val() as Record<string, CompOffUsage> | null || {};

    for (const [usageId, usage] of Object.entries(usageRecords)) {
      if (usage.creditId === id && usage.status === "pending") {
        await rtdb.ref(`compOffUsage/${usageId}`).update({
          status: "rejected",
          updatedAt: new Date().toISOString(),
        });
        break;
      }
    }

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`notifications/${notificationId}`).set({
      id: notificationId,
      userId: credit.userId,
      title: "Comp-Off Request Rejected",
      message: `Your comp-off request has been rejected by HOD.`,
      type: "comp_off_rejected",
      isRead: false,
      metadata: JSON.stringify({
        creditId: id,
        status: "rejected",
      }),
      createdAt: new Date().toISOString(),
    });

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