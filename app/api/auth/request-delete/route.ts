import { NextResponse } from "next/server";
//import { auth, rtdb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
const rtdb = getRTDB();
const auth = getAuth();
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

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // ✅ FIXED: Using RTDB instead of Firestore
    const snapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = snapshot.val();

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const deletedAt = new Date().toISOString();

    // Update user status in RTDB
    await rtdb.ref(`users/${userId}`).update({
      status: "deleted",
      deletedAt: deletedAt,
      deletedBy: userId,
      updatedAt: new Date().toISOString(),
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