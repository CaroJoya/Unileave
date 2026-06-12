import { NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function GET() {
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

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data();

    if (userData?.status !== "deleted") {
      return NextResponse.json({
        status: "active",
        daysLeft: null,
      });
    }

    const deletedAt = userData.deletedAt?.toDate?.() || new Date(userData.deletedAt);
    const now = new Date();
    const daysSinceDeletion = (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, 30 - Math.floor(daysSinceDeletion));

    return NextResponse.json({
      status: "deleted",
      daysLeft,
    });
  } catch (error) {
    console.error("Account status error:", error);
    return NextResponse.json(
      { error: "Failed to get account status" },
      { status: 500 }
    );
  }
}