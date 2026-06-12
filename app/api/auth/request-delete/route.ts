import { NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase/admin";
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

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const deletedAt = new Date().toISOString();

    await userRef.update({
      status: "deleted",
      deletedAt,
      deletedBy: userId,
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