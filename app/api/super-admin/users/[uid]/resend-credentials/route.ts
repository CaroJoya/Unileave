// app/api/super-admin/users/[uid]/resend-credentials/route.ts - NEW FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail} from "@/lib/utils/email";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
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
    
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as { name?: string; roles?: string[] } | null;
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized - Super Admin only" }, { status: 403 });
    }

    const userSnapshot = await rtdb.ref(`users/${uid}`).once("value");
    const userData = userSnapshot.val() as { name?: string; email?: string } | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a password reset link (secure way to set password)
    const resetLink = await auth.generatePasswordResetLink(userData.email!);

    // Send the email with the reset link
    const emailSent = await sendEmail(
      userData.email!,
      "🔑 UniLeave Account Access",
      `
      <h2>Welcome to UniLeave!</h2>
      <p>Your account has been set up by <strong>${adminData.name || "Super Admin"}</strong>.</p>
      <p>Please click the link below to set your password and access your account:</p>
      <a href="${resetLink}">Set Your Password</a>
      <p>This link will expire in 1 hour.</p>
      `
    );

    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    // Log the action
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: decodedToken.uid,
      userName: adminData.name || "Super Admin",
      userRole: "super_admin",
      action: "CREDENTIALS_RESENT",
      module: "users",
      targetId: uid,
      targetUser: userData.email,
      details: JSON.stringify({
        action: "Resent credentials email",
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Credentials email sent successfully",
    });
  } catch (error) {
    console.error("Error resending credentials:", error);
    return NextResponse.json(
      { error: "Failed to resend credentials" },
      { status: 500 }
    );
  }
}