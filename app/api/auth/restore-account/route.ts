// app/api/auth/restore-account/route.ts - FIXED
import { NextResponse } from "next/server";
import { getAuth, getRTDB } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
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

    if (userData.status !== "deleted") {
      return NextResponse.json(
        { error: "Account is not deactivated" },
        { status: 400 }
      );
    }

    const deletedAt = new Date(userData.deletedAt);
    const now = new Date();
    const daysSinceDeletion = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDeletion > 30) {
      return NextResponse.json(
        { error: "Account restoration window has expired (30 days)" },
        { status: 400 }
      );
    }

    await rtdb.ref(`users/${userId}`).update({
      status: "active",
      deletedAt: null,
      restoredAt: new Date().toISOString(),
      restoredBy: userId,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Account restored successfully",
    });
  } catch (error) {
    console.error("Restore account error:", error);
    return NextResponse.json(
      { error: "Failed to restore account" },
      { status: 500 }
    );
  }
}