import { NextResponse } from "next/server";
import { db, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Get session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify session and get user
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // Get user document
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    // Check if account is deleted
    if (userData?.status !== "deleted") {
      return NextResponse.json(
        { error: "Account is not deactivated" },
        { status: 400 }
      );
    }

    // Check if within 30-day window
    const deletedAt = userData.deletedAt?.toDate?.() || new Date(userData.deletedAt);
    const now = new Date();
    const daysSinceDeletion = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDeletion > 30) {
      return NextResponse.json(
        { error: "Account restoration window has expired (30 days)" },
        { status: 400 }
      );
    }

    // Restore account
    await userRef.update({
      status: "active",
      deletedAt: null,
      restoredAt: new Date().toISOString(),
      restoredBy: userId,
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