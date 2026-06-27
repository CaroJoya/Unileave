// app/api/test-email/route.ts - FIXED
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/utils/email";

export async function GET() {
  try {
    const testEmail = process.env.SMTP_USER || "test@example.com";
    
    const result = await sendEmail(
      testEmail,
      "✅ UniLeave SMTP Test",
      `
      <h1>SMTP Configuration Test</h1>
      <p>This email confirms your SMTP settings are working!</p>
      <ul>
        <li>Host: ${process.env.SMTP_HOST}</li>
        <li>Port: ${process.env.SMTP_PORT}</li>
        <li>From: ${process.env.SMTP_FROM_EMAIL || "noreply@unileave.edu"}</li>
      </ul>
      <p style="color:green;font-weight:bold;">✅ Email sent successfully!</p>
      `
    );

    return NextResponse.json({
      success: result,
      message: result ? "Test email sent!" : "Failed to send test email",
      debug: {
        smtpConfigured: !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        fromEmail: process.env.SMTP_FROM_EMAIL || "noreply@unileave.edu",
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}