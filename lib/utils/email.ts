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

// ========== LEAVE REQUEST EMAILS ==========

export function getLeaveSubmittedEmail(
  applicantName: string, 
  leaveType: string, 
  startDate: string, 
  endDate: string, 
  reason: string, 
  approverDashboardUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366F1;">New Leave Request</h2>
      <p><strong>${applicantName}</strong> has submitted a leave request for your approval.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0;"><strong>Leave Type:</strong></td>
        <td>${leaveType}</td>
      </tr>
      <tr><td style="padding: 8px 0;"><strong>Dates:</strong></td>
        <td>${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</td>
      </tr>
      <tr><td style="padding: 8px 0;"><strong>Reason:</strong></td>
        <td>${reason}</td>
      </tr>
      </table>
      <a href="${approverDashboardUrl}" style="display: inline-block; background-color: #6366F1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Review Request</a>
    </div>
  `;
}

export function getLeaveApprovedEmail(
  applicantName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  approverName: string,
  statusPageUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Leave Request Approved</h2>
      <p>Dear ${applicantName},</p>
      <p>Your <strong>${leaveType}</strong> leave request has been <strong style="color: green;">approved</strong> by ${approverName}.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0;"><strong>Dates:</strong></td>
        <td>${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</td>
      </tr>
      <tr><td style="padding: 8px 0;"><strong>Total Days:</strong></td>
        <td>${totalDays} day(s)</td>
      </tr>
      </table>
      <a href="${statusPageUrl}" style="display: inline-block; background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Status</a>
    </div>
  `;
}

export function getLeaveRejectedEmail(
  applicantName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason: string,
  approverName: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #EF4444;">Leave Request Rejected</h2>
      <p>Dear ${applicantName},</p>
      <p>Your <strong>${leaveType}</strong> leave request has been <strong style="color: red;">rejected</strong> by ${approverName}.</p>
      <div style="background-color: #FEE2E2; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <strong>Rejection Reason:</strong>
        <p>${reason}</p>
      </div>
      <p>You can submit a new request if needed.</p>
    </div>
  `;
}

export function getRevisionEmail(
  applicantName: string, 
  remarkText: string, 
  statusPageUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #F59E0B;">Revision Required</h2>
      <p>Dear ${applicantName},</p>
      <p>Your leave request requires revision. The approver has sent the following remarks:</p>
      <div style="background-color: #FEF3C7; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <em>${remarkText}</em>
      </div>
      <a href="${statusPageUrl}" style="display: inline-block; background-color: #6366F1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View & Edit Request</a>
    </div>
  `;
}

export function getResubmittedEmail(
  applicantName: string, 
  statusPageUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366F1;">Leave Request Resubmitted</h2>
      <p><strong>${applicantName}</strong> has resubmitted their leave request for your approval.</p>
      <a href="${statusPageUrl}" style="display: inline-block; background-color: #6366F1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Review Request</a>
    </div>
  `;
}

// ========== COMP-OFF EMAILS ==========

export function getCompOffApprovedEmail(
  applicantName: string,
  creditedDays: number,
  expiryDate: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Comp-Off Credit Approved</h2>
      <p>Dear ${applicantName},</p>
      <p>Your compensatory off request has been <strong style="color: green;">approved</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0;"><strong>Credited Days:</strong></td>
        <td>${creditedDays} day(s)</td>
      </tr>
      <tr><td style="padding: 8px 0;"><strong>Expiry Date:</strong></td>
        <td>${new Date(expiryDate).toLocaleDateString()}</td>
      </tr>
      </table>
      <p>You can now apply for comp-off leave from your dashboard.</p>
    </div>
  `;
}

export function getCompOffRejectedEmail(
  applicantName: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #EF4444;">Comp-Off Request Rejected</h2>
      <p>Dear ${applicantName},</p>
      <p>Your compensatory off request has been <strong style="color: red;">rejected</strong>.</p>
      <p>Please contact your HOD for more information.</p>
    </div>
  `;
}

// ========== OVERWORK EMAILS ==========

export function getOverworkApprovedEmail(
  applicantName: string,
  hours: number,
  earnedLeaveDays: number
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Overwork Hours Approved</h2>
      <p>Dear ${applicantName},</p>
      <p>Your overwork entry of <strong>${hours} hours</strong> has been <strong style="color: green;">approved</strong>.</p>
      ${earnedLeaveDays > 0 ? `
        <div style="background-color: #D1FAE5; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <strong>🎉 You earned ${earnedLeaveDays} comp-off day(s)!</strong>
          <p>The credits have been added to your comp-off balance.</p>
        </div>
      ` : `
        <p>You need ${5 - (hours % 5)} more hours to earn a comp-off day.</p>
      `}
    </div>
  `;
}

export function getOverworkRejectedEmail(
  applicantName: string,
  hours: number
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #EF4444;">Overwork Request Rejected</h2>
      <p>Dear ${applicantName},</p>
      <p>Your overwork entry of <strong>${hours} hours</strong> has been <strong style="color: red;">rejected</strong>.</p>
      <p>Please contact your HOD for more information.</p>
    </div>
  `;
}

// ========== VACATION EMAILS ==========

export function getVacationApprovedEmail(
  applicantName: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  paidDays: number,
  unpaidDays: number,
  statusPageUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Vacation Request Approved</h2>
      <p>Dear ${applicantName},</p>
      <p>Your vacation request has been <strong style="color: green;">approved</strong> by HOD.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0;"><strong>Dates:</strong></td>
        <td>${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</td>
      </tr>
      <tr><td style="padding: 8px 0;"><strong>Total Days:</strong></td>
        <td>${totalDays} day(s)</td>
      </tr>
      <tr><td style="padding: 8px 0;"><strong>Paid Days:</strong></td>
        <td>${paidDays} day(s)</td>
      </tr>
      <tr><td style="padding: 8px 0;"><strong>Unpaid Days:</strong></td>
        <td>${unpaidDays} day(s)</td>
      </tr>
      </table>
      <a href="${statusPageUrl}" style="display: inline-block; background-color: #10B981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">View Status</a>
    </div>
  `;
}

export function getVacationRejectedEmail(
  applicantName: string,
  reason: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #EF4444;">Vacation Request Rejected</h2>
      <p>Dear ${applicantName},</p>
      <p>Your vacation request has been <strong style="color: red;">rejected</strong> by HOD.</p>
      <div style="background-color: #FEE2E2; padding: 12px; border-radius: 6px; margin: 16px 0;">
        <strong>Rejection Reason:</strong>
        <p>${reason}</p>
      </div>
    </div>
  `;
}