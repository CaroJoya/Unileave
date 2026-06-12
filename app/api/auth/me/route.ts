import { NextResponse } from "next/server";
import { auth, rtdb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { Auth } from 'firebase-admin/auth';
import { Database } from 'firebase-admin/database';

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

    // Check if auth is initialized
    if (!auth) {
      console.error("Firebase Auth not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify session
    const decodedToken = await (auth as Auth).verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    // Check if rtdb is initialized
    if (!rtdb) {
      console.error("Firebase Database not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get user data from Realtime Database
    const snapshot = await (rtdb as Database).ref(`users/${userId}`).once('value');
    const userData = snapshot.val();

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        uid: userId,
        ...userData,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Invalid session" },
      { status: 401 }
    );
  }
}