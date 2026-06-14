// lib/utils/email.ts
import nodemailer from "nodemailer";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }: EmailPayload) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("⚠️ SMTP configuration is incomplete. Skipping email send.");
    return;
  }

  try {
    await transporter.sendMail({
      from: `"UniLeave" <${process.env.SMTP_FROM_EMAIL || "noreply@unileave.edu"}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email transmission failed:", error);
  }
}

export function getLeaveSubmittedEmail(applicantName: string, leaveType: string, startDate: string, endDate: string, reason: string, approverDashboardUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366F1;">New Leave Request</h2>
      <p><strong>${applicantName}</strong> has submitted a leave request for your approval.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0;"><strong>Leave Type:</strong></td><td>${leaveType}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Dates:</strong></td><td>${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Reason:</strong></td><td>${reason}</td></tr>
      </table>
      <a href="${approverDashboardUrl}" style="display: inline-block; background-color: #6366F1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Review Request</a>
    </div>
  `;
}

export function getRevisionEmail(applicantName: string, remarkText: string, statusPageUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366F1;">Revision Required</h2>
      <p>Dear ${applicantName},</p>
      <p>Your leave request requires revision. The approver has sent the following remarks:</p>
      <div style="background-color: #F3F4F6; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <em>${remarkText}</em>
      </div>
      <a href="${statusPageUrl}" style="display: inline-block; background-color: #6366F1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View & Edit Request</a>
    </div>
  `;
}

export function getResubmittedEmail(applicantName: string, statusPageUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366F1;">Leave Request Resubmitted</h2>
      <p><strong>${applicantName}</strong> has resubmitted their leave request for your approval.</p>
      <a href="${statusPageUrl}" style="display: inline-block; background-color: #6366F1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Review Request</a>
    </div>
  `;
}