import { NextResponse } from "next/server";
import { getAuth, getRTDB } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { createAuditLog } from "@/lib/services/audit-service";

export async function POST(
  request: Request,
  { params }: { params: { uid: string } }
) {
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

    // Verify admin session
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const adminId = decodedToken.uid;
    
    // Get admin user data
    const adminSnapshot = await rtdb.ref(`users/${adminId}`).once('value');
    const adminData = adminSnapshot.val();
    
    if (!adminData || !adminData.roles?.includes('super_admin')) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin access required" },
        { status: 403 }
      );
    }

    // Get target user data
    const targetUid = params.uid;
    const targetSnapshot = await rtdb.ref(`users/${targetUid}`).once('value');
    const targetUserData = targetSnapshot.val();

    if (!targetUserData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (targetUserData.status === "deleted") {
      return NextResponse.json(
        { error: "User already deactivated" },
        { status: 400 }
      );
    }

    // Deactivate the user
    const deletedAt = new Date().toISOString();
    await rtdb.ref(`users/${targetUid}`).update({
      status: "deleted",
      deletedAt: deletedAt,
      deletedBy: adminId,
      updatedAt: new Date().toISOString(),
    });

    // Create audit log
    await createAuditLog({
      userId: adminId,
      userName: adminData.name || "Unknown Admin",
      userRole: "super_admin",
      action: "USER_DEACTIVATED",
      module: "users",
      targetId: targetUid,
      targetUser: targetUserData.email,
      oldData: { status: targetUserData.status },
      newData: { status: "deleted", deletedAt },
      details: { deletedBy: adminId },
    });

    return NextResponse.json({
      success: true,
      message: "User deactivated successfully",
      deletedAt,
    });

  } catch (error) {
    console.error("Error deactivating user:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to deactivate user";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
