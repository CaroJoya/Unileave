// app/api/auth/session/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { rateLimitMiddleware } from "@/lib/middleware/rate-limit";

export async function POST(request: Request) {
  try {
    // ✅ FIX: Create a NextRequest-like object for rate limiting
    // The rateLimitMiddleware expects NextRequest, but we have Request
    // We'll pass the request as any since we only use headers and pathname
    const rateLimitResponse = rateLimitMiddleware(request as unknown as NextRequest, {
      windowMs: 5 * 60 * 1000,
      maxRequests: 5,
      skipPaths: [],
    });
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: "ID token is required" }, { status: 400 });
    }

    const auth = getAuth();

    if (!auth) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Firebase Admin not configured. Please check environment variables." },
        { status: 500 }
      );
    }

    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Session creation error:", error);
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

    const auth = getAuth();
    if (!auth) {
      console.error("Firebase Admin not initialized");
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