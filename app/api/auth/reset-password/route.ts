import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Verify the reset token and update password
    // Note: Firebase Admin SDK doesn't have a direct method to verify reset tokens
    // We need to use the Firebase Auth REST API or client SDK
    // For now, we'll implement using the REST API
    
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oobCode: token,
          newPassword: password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Reset password error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}