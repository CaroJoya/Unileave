import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

const rtdb = getRTDB();
const auth = getAuth();

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

    if (userData.status !== "deleted") {
      return NextResponse.json({
        status: "active",
        daysLeft: null,
      });
    }

    const deletedAt = new Date(userData.deletedAt);
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