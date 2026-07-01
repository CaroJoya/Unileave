// app/api/principal/comp-off-credits/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { createNotification } from "@/lib/services/notification-service";
import { NotificationType } from "@/lib/constants/notification-types";

interface CompOffCredit {
  id: string;
  userId: string;
  userName?: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: string;
  hoursWorked?: number;
  attachmentUrl?: string | null;
  requestedAt?: string;
  requestedByName?: string;
  createdAt: string;
}

interface UserData {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  collegeId: string;
}

export async function GET() {
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
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as UserData | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    const collegeId = principalData.collegeId;

    // Get all users in the same college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, UserData> || {};
    
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);

    // Get all comp-off credits with pending_approval status
    const creditsSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCredits = creditsSnapshot.val() as Record<string, CompOffCredit> || {};

    const pendingCredits: (CompOffCredit & { id: string; userName: string })[] = [];

    for (const [id, credit] of Object.entries(allCredits)) {
      if (credit.status === 'pending_approval' && collegeUserIds.includes(credit.userId)) {
        const user = allUsers[credit.userId];
        pendingCredits.push({
          ...credit,
          id,
          userName: user?.name || "Unknown User",
        });
      }
    }

    // Sort by requestedAt (newest first)
    pendingCredits.sort((a, b) => 
      new Date(b.requestedAt || b.createdAt).getTime() - new Date(a.requestedAt || a.createdAt).getTime()
    );

    return NextResponse.json({ credits: pendingCredits });
  } catch (error) {
    console.error("Error fetching pending comp-off credits:", error);
    return NextResponse.json({ error: "Failed to fetch pending comp-off credits" }, { status: 500 });
  }
}

// ============ POST: Approve or Reject (for Principal) ============

export async function POST(request: Request) {
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
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as UserData | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    const body = await request.json();
    const { creditId, action, remark } = body;

    if (!creditId) {
      return NextResponse.json({ error: "Credit ID is required" }, { status: 400 });
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
    }

    if (action === 'reject' && (!remark || remark.trim() === '')) {
      return NextResponse.json({ error: "Rejection remark is required" }, { status: 400 });
    }

    // Get the credit to get the applicant ID
    const creditSnapshot = await rtdb.ref(`compOffCredits/${creditId}`).once("value");
    const credit = creditSnapshot.val() as CompOffCredit | null;

    if (!credit) {
      return NextResponse.json({ error: "Comp-off credit not found" }, { status: 404 });
    }

    if (credit.status !== 'pending_approval') {
      return NextResponse.json({ error: `Credit is ${credit.status}, not pending approval` }, { status: 400 });
    }

    let notificationMessage: string;
    let notificationType: NotificationType;

    if (action === 'approve') {
      // ✅ APPROVE: Set status to 'active'
      await rtdb.ref(`compOffCredits/${creditId}`).update({
        status: 'active',
        approvedBy: principalId,
        approvedByName: principalData.name,
        approvalRemark: remark || null,
        updatedAt: new Date().toISOString(),
      });
      
      notificationMessage = `Your comp-off credit request for ${credit.creditedDays} day(s) has been approved by Principal ${principalData.name}.`;
      notificationType = NotificationType.COMPOFF_APPROVED;
    } else {
      // ✅ REJECT: Set status to 'rejected'
      await rtdb.ref(`compOffCredits/${creditId}`).update({
        status: 'rejected',
        approvedBy: principalId,
        approvedByName: principalData.name,
        approvalRemark: remark,
        updatedAt: new Date().toISOString(),
      });
      
      notificationMessage = `Your comp-off credit request for ${credit.creditedDays} day(s) has been rejected by Principal ${principalData.name}. Reason: ${remark}`;
      notificationType = NotificationType.COMPOFF_REJECTED;
    }

    // ============ NOTIFY APPLICANT ============
    await createNotification({
      userId: credit.userId,
      type: notificationType,
      title: action === 'approve' ? "Comp-Off Credit Approved" : "Comp-Off Credit Rejected",
      message: notificationMessage,
      metadata: {
        creditId,
        creditedDays: credit.creditedDays,
        hoursWorked: credit.hoursWorked,
        action,
        remark,
        approver: "principal",
        approverName: principalData.name,
      },
    });

    // ============ LOG ACTION ============
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await rtdb.ref(`approvalLogs/${logId}`).set({
      id: logId,
      compOffCreditId: creditId,
      actionBy: principalId,
      actionByName: principalData.name,
      actionRole: "principal",
      action: action === 'approve' ? "APPROVE_COMP_OFF_CREDIT" : "REJECT_COMP_OFF_CREDIT",
      remark: remark || null,
      oldStatus: "pending_approval",
      newStatus: action === 'approve' ? "active" : "rejected",
      actionAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true,
      message: `Comp-off credit ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
    });

  } catch (error) {
    console.error("Error processing comp-off credit:", error);
    return NextResponse.json({ error: "Failed to process comp-off credit" }, { status: 500 });
  }
}