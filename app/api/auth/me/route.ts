// app/api/auth/me/route.ts - OPTIMIZED WITH PARALLEL QUERIES
import { NextResponse } from "next/server";
import { getAuth, getRTDB } from "@/lib/firebase/admin";
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

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // ✅ Verify session
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // ✅ Get user data from RTDB
    const snapshot = await rtdb.ref(`users/${userId}`).once('value');
    const userData = snapshot.val();

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // ✅ Add cache headers
    const response = NextResponse.json({
      user: {
        uid: userId,
        ...userData,
      },
    });

    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

    return response;
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 401 }
    );
  }
}