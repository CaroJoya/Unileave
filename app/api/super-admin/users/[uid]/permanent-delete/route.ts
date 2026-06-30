// app/api/super-admin/users/[uid]/permanent-delete/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { createAuditLog } from "@/lib/services/audit-service";
import { unassignAllRoles } from "@/lib/utils/role-unassignment";

export async function DELETE(
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
    const adminData = adminSnapshot.val();

    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (uid === decodedToken.uid) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const userSnapshot = await rtdb.ref(`users/${uid}`).once("value");
    const userData = userSnapshot.val();

    if (!userData) {
      try {
        await auth.deleteUser(uid);
        return NextResponse.json({
          success: true,
          message: "User deleted from Auth (RTDB user not found)",
        });
      } catch {
        return NextResponse.json(
          {
            error: "User not found in database",
            details: "User may already be deleted",
          },
          { status: 404 }
        );
      }
    }

    // ✅ Use the shared utility to unassign all roles
    const userRoles = userData.roles || [];
    const { unassignments } = await unassignAllRoles(uid, userRoles, userData);

    // Get user data before deletion for audit log
    const userEmail = userData.email || uid;
    const userName = userData.name || "Unknown User";

    // Delete from Auth
    let authDeleted = false;
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
    } catch (authError) {
      console.error("Auth deletion error - continuing with RTDB deletion:", authError);
    }

    // Delete from RTDB
    await rtdb.ref(`users/${uid}`).remove();

    // Log the deletion
    await createAuditLog({
      userId: decodedToken.uid,
      userName: adminData.name || "Super Admin",
      userRole: "super_admin",
      action: "USER_DELETED",
      module: "users",
      targetId: uid,
      targetUser: userEmail,
      details: {
        deletedUser: userName,
        userRoles: userRoles,
        authDeleted: authDeleted,
        unassignments: unassignments,
        unassignedCount: unassignments.length,
      },
    });

    // Log each unassignment separately for better tracking
    for (const logMessage of unassignments) {
      await createAuditLog({
        userId: decodedToken.uid,
        userName: adminData.name || "Super Admin",
        userRole: "super_admin",
        action: "ROLE_UNASSIGNED",
        module: "departments",
        targetId: uid,
        targetUser: userEmail,
        details: {
          action: logMessage,
          deletedUser: userName,
          userRole: userRoles.find((r: string) =>
            ["hod", "registrar", "principal"].includes(r)
          ) || "unknown",
        },
      });
    }

    return NextResponse.json({
      success: true,
      authDeleted,
      unassignments: unassignments,
      message: `User deleted${authDeleted ? "" : " (Auth deletion failed)"}${
        unassignments.length > 0 ? ` - ${unassignments.length} role(s) unassigned` : ""
      }`,
    });
  } catch (error) {
    console.error("Error permanently deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}