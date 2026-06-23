// app/api/super-admin/users/[uid]/permanent-delete/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    // Check if user is super admin
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val();
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Check if trying to delete yourself
    if (uid === decodedToken.uid) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const userSnapshot = await rtdb.ref(`users/${uid}`).once("value");
    const userData = userSnapshot.val();

    if (!userData) {
      // User doesn't exist in RTDB, but might exist in Auth
      try {
        await auth.deleteUser(uid);
        return NextResponse.json({ 
          success: true, 
          message: "User deleted from Auth (RTDB user not found)" 
        });
      } catch {
        // authError is intentionally not used
        return NextResponse.json({ 
          error: "User not found in database", 
          details: "User may already be deleted" 
        }, { status: 404 });
      }
    }

    // Delete from Auth (with error handling)
    let authDeleted = false;
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
    } catch {
      // authError is intentionally not used - we continue even if Auth deletion fails
      console.error("Auth deletion error - continuing with RTDB deletion");
      // Continue to delete from RTDB even if Auth deletion fails
    }

    // Delete from Realtime Database
    await rtdb.ref(`users/${uid}`).remove();

    return NextResponse.json({ 
      success: true, 
      authDeleted,
      message: authDeleted ? "User deleted successfully" : "User deleted from database only (Auth deletion failed)"
    });
  } catch (error) {
    console.error("Error permanently deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}