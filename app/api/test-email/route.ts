// app/api/test-email/route.ts - COMPLETE FINAL VERSION
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/utils/email";

export async function GET() {
  try {
    const testEmail = process.env.SMTP_USER || "test@example.com";
    
    console.log("📧 Testing email with:", {
      to: testEmail,
      smtpUser: process.env.SMTP_USER ? "✅ Set" : "❌ Not set",
      smtpPass: process.env.SMTP_PASSWORD ? "✅ Set" : "❌ Not set",
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
    });
    
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
        <li>To: ${testEmail}</li>
      </ul>
      <p style="color:green;font-weight:bold;">✅ Email sent successfully!</p>
      <p style="font-size:12px;color:#6b7280;">Sent at: ${new Date().toLocaleString()}</p>
      `
    );

    return NextResponse.json({
      success: result,
      message: result ? "Test email sent successfully!" : "Failed to send test email",
      debug: {
        smtpConfigured: !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD,
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        fromEmail: process.env.SMTP_FROM_EMAIL || "noreply@unileave.edu",
        toEmail: testEmail,
        result: result,
      }
    });
  } catch (error) {
    console.error("❌ Test email error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        debug: {
          smtpConfigured: !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD,
          smtpHost: process.env.SMTP_HOST,
          smtpPort: process.env.SMTP_PORT,
        }
      },
      { status: 500 }
    );
  }
}