import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { createAuditLog } from "@/lib/services/audit-service";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    const snapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = snapshot.val();

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const deletedAt = new Date().toISOString();

    await rtdb.ref(`users/${userId}`).update({
      status: "deleted",
      deletedAt: deletedAt,
      deletedBy: userId,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog({
      userId,
      userName: userData.name || "Unknown User",
      userRole: userData.roles?.[0] || "user",
      action: "USER_DEACTIVATED",
      module: "users",
      targetId: userId,
      targetUser: userData.email,
      oldData: { status: userData.status },
      newData: { status: "deleted", deletedAt },
      details: { selfDeletion: true },
    });

    return NextResponse.json({
      success: true,
      message: "Account deactivated. You have 30 days to restore.",
      deletedAt,
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}