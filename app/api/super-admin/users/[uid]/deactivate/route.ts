// app/api/super-admin/users/[uid]/deactivate/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getAuth, getRTDB } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { createAuditLog } from "@/lib/services/audit-service";
import { unassignAllRoles } from "@/lib/utils/role-unassignment";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
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
    const adminSnapshot = await rtdb.ref(`users/${adminId}`).once("value");
    const adminData = adminSnapshot.val();

    if (!adminData || !adminData.roles?.includes("super_admin")) {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin access required" },
        { status: 403 }
      );
    }

    // Get target user data
    const targetSnapshot = await rtdb.ref(`users/${uid}`).once("value");
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

    // ✅ Unassign all roles before deactivation
    const userRoles = targetUserData.roles || [];
    const { unassignments } = await unassignAllRoles(uid, userRoles, targetUserData);

    // Deactivate the user
    const deletedAt = new Date().toISOString();
    await rtdb.ref(`users/${uid}`).update({
      status: "deleted",
      deletedAt: deletedAt,
      deletedBy: adminId,
      updatedAt: new Date().toISOString(),
    });

    // Create audit log for deactivation
    await createAuditLog({
      userId: adminId,
      userName: adminData.name || "Unknown Admin",
      userRole: "super_admin",
      action: "USER_DEACTIVATED",
      module: "users",
      targetId: uid,
      targetUser: targetUserData.email,
      oldData: { status: targetUserData.status },
      newData: { status: "deleted", deletedAt },
      details: {
        deletedBy: adminId,
        unassignments: unassignments,
        unassignedCount: unassignments.length,
      },
    });

    // Log each unassignment
    for (const logMessage of unassignments) {
      await createAuditLog({
        userId: adminId,
        userName: adminData.name || "Unknown Admin",
        userRole: "super_admin",
        action: "ROLE_UNASSIGNED",
        module: "departments",
        targetId: uid,
        targetUser: targetUserData.email,
        details: {
          action: logMessage,
          deactivatedUser: targetUserData.name,
          deactivatedBy: adminId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `User deactivated successfully.${unassignments.length > 0 ? ` ${unassignments.length} role(s) unassigned.` : ''}`,
      deletedAt,
      unassignments: unassignments,
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