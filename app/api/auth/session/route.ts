import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken } = body;

    console.log("Session API called, idToken exists:", !!idToken);

    if (!idToken) {
      console.error("No ID token provided");
      return NextResponse.json({ error: "ID token is required" }, { status: 400 });
    }

    // Check if Firebase Admin is initialized
    if (!auth) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Firebase Admin not configured" },
        { status: 500 }
      );
    }

    // ✅ FIX: Max allowed is 14 days (1,209,600,000 ms)
    const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
    console.log("Creating session cookie with expiry (ms):", expiresIn);
    
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn,
    });
    
    console.log("Session cookie created successfully");

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    console.log("Cookie set successfully");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Session creation error details:", {
      message: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Session deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    if (!auth) {
      return NextResponse.json({ authenticated: false }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    return NextResponse.json({ 
      authenticated: true,
      uid: decodedToken.uid,
      email: decodedToken.email 
    });
  } catch (error: unknown) {
    console.error("Session verification error:", error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}