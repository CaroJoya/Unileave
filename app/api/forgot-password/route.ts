// app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/utils/email";
import { getAuth } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // ✅ Check if auth is initialized
    const auth = getAuth();
    if (!auth) {
      console.error("Firebase Admin Auth not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Generate password reset link using Firebase Auth
    let resetLink: string;
    try {
      resetLink = await auth.generatePasswordResetLink(email);
    } catch (authError: unknown) {
      const error = authError as { code?: string };
      if (error.code === "auth/user-not-found") {
        // Don't reveal that user doesn't exist for security
        return NextResponse.json({
          success: true,
          message: "If an account exists, a reset link will be sent",
        });
      }
      throw authError;
    }

    // ✅ Send email with the reset link - FIXED
    const emailHtml = getPasswordResetEmailTemplate(resetLink);
    
    // ✅ FIXED: sendEmail expects 3 args: to, subject, html
    await sendEmail(
      email,
      "Reset Your UniLeave Password",
      emailHtml
    );

    return NextResponse.json({
      success: true,
      message: "Password reset email sent",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to send reset email" },
      { status: 500 }
    );
  }
}

function getPasswordResetEmailTemplate(resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 12px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
        <h1 style="color: #6366F1; font-size: 28px; margin: 0;">UniLeave</h1>
        <p style="color: #6b7280; margin: 4px 0 0 0;">University Leave Management System</p>
      </div>
      
      <div style="padding: 24px 0;">
        <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 12px 0;">Password Reset Request</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
          We received a request to reset your UniLeave account password. Click the button below to create a new password:
        </p>
        
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}" 
             style="display: inline-block; background-color: #6366F1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="color: #6366F1; font-size: 13px; word-break: break-all; background-color: #f3f4f6; padding: 12px; border-radius: 6px; margin: 0;">
          ${resetLink}
        </p>
        
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <p style="color: #92400e; font-size: 14px; margin: 0;">
            ⚠️ This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </p>
        </div>
      </div>
      
      <div style="border-top: 2px solid #e5e7eb; padding-top: 16px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This is an automated message from UniLeave. Please do not reply to this email.
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0 0;">
          &copy; ${new Date().getFullYear()} UniLeave. All rights reserved.
        </p>
      </div>
    </div>
  `;
}