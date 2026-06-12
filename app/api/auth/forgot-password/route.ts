import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Generate password reset link using Firebase Auth
    const resetLink = await auth.generatePasswordResetLink(email);

    // TODO: Send email via Resend with the reset link
    // For now, log the link (in production, send actual email)
    console.log("Password reset link:", resetLink);

    return NextResponse.json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error: unknown) {
    console.error("Forgot password error:", error);
    
    const firebaseError = error as { code?: string };
    if (firebaseError.code === "auth/user-not-found") {
      // Don't reveal that user doesn't exist for security
      return NextResponse.json({
        success: true,
        message: "If an account exists, a reset link will be sent",
      });
    }

    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 }
    );
  }
}