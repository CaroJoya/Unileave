// lib/utils/email.ts - COMPLETE UPDATED VERSION
import nodemailer from "nodemailer";

// ========== SMTP CONFIGURATION ==========
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASSWORD;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@unileave.edu";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "UniLeave";

let transporter: nodemailer.Transporter | null = null;
let mailEnabled = false;

// ========== INITIALIZE SMTP ==========
if (SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    
    mailEnabled = true;
    
    transporter.verify((error) => {
      if (error) {
        console.error("❌ SMTP Verification Failed:", error.message);
        mailEnabled = false;
      } else {
        console.log("✅ SMTP configured successfully");
        mailEnabled = true;
      }
    });
  } catch (err) {
    console.error("❌ Failed to initialize SMTP:", err);
    mailEnabled = false;
  }
} else {
  console.warn("⚠️ SMTP not configured. Emails will be logged only.");
}

// ========== CORE SEND FUNCTION ==========
export async function sendEmail(
  toOrOptions: string | { to: string; subject: string; html: string },
  subject?: string,
  html?: string
): Promise<boolean> {
  let to: string;
  let finalSubject: string;
  let finalHtml: string;

  if (typeof toOrOptions === 'string') {
    to = toOrOptions;
    finalSubject = subject || '';
    finalHtml = html || '';
  } else {
    to = toOrOptions.to;
    finalSubject = toOrOptions.subject;
    finalHtml = toOrOptions.html;
  }

  if (!mailEnabled || !transporter) {
    console.log("📝 [EMAIL-LOG] To:", to);
    console.log("📝 [EMAIL-LOG] Subject:", finalSubject);
    console.log("📝 [EMAIL-LOG] ⚠️ Email not sent - SMTP not configured");
    return false;
  }

  if (!to || !to.includes("@")) {
    console.error("❌ Invalid recipient email:", to);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to,
      subject: finalSubject,
      html: finalHtml,
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Send failed to ${to}:`, error);
    return false;
  }
}

// ========== HELPER ==========
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://unileave.vercel.app";
}

// ========== EMAIL TEMPLATES ==========

// 1. LEAVE SUBMITTED - To Approver
export function getLeaveSubmittedEmail(
  applicantName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason: string
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366F1,#4f46e5);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">📋 New Leave Request</h1>
      <p style="margin:8px 0 0;opacity:0.9;">UniLeave - University Leave Management</p>
    </div>
    <div style="padding:30px;">
      <p><strong>Requester:</strong> ${applicantName}</p>
      <p><strong>Leave Type:</strong> ${leaveType}</p>
      <p><strong>Period:</strong> ${new Date(startDate).toLocaleDateString()} → ${new Date(endDate).toLocaleDateString()}</p>
      <p><strong>Reason:</strong> ${reason || "No reason provided"}</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#6366F1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to review this request
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 2. LEAVE APPROVED - To Applicant
export function getLeaveApprovedEmail(
  applicantName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  approverName: string
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#10B981,#059669);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">✅ Leave Approved</h1>
      <p style="margin:8px 0 0;opacity:0.9;">Approved by ${approverName}</p>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your <strong>${leaveType}</strong> leave request has been <strong style="color:#10B981;">approved</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;"><strong>Dates:</strong></td><td>${new Date(startDate).toLocaleDateString()} → ${new Date(endDate).toLocaleDateString()}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Total Days:</strong></td><td>${totalDays} day(s)</td></tr>
        <tr><td style="padding:8px 0;"><strong>Approved By:</strong></td><td>${approverName}</td></tr>
      </table>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#10B981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view your updated status
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 3. LEAVE REJECTED - To Applicant
export function getLeaveRejectedEmail(
  applicantName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  reason: string,
  approverName: string
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#EF4444,#DC2626);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">❌ Leave Rejected</h1>
      <p style="margin:8px 0 0;opacity:0.9;">Rejected by ${approverName}</p>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your <strong>${leaveType}</strong> leave request has been <strong style="color:#EF4444;">rejected</strong>.</p>
      <div style="background-color:#FEE2E2;padding:16px;border-radius:8px;margin:16px 0;">
        <strong>Rejection Reason:</strong>
        <p style="margin:8px 0 0;">${reason || "No reason provided"}</p>
      </div>
      <p style="font-size:14px;color:#6b7280;">You can submit a new request if needed.</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#EF4444;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view the details
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 4. REVISION REQUESTED - To Applicant
export function getRevisionEmail(
  applicantName: string,
  remarkText: string
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#F59E0B,#D97706);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">✏️ Revision Required</h1>
      <p style="margin:8px 0 0;opacity:0.9;">Your leave request needs revision</p>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your leave request needs revision. The approver has sent the following remarks:</p>
      <div style="background-color:#FEF3C7;padding:16px;border-radius:8px;margin:16px 0;">
        <em>${remarkText}</em>
      </div>
      <p style="font-size:14px;color:#6b7280;">Please edit your request and resubmit for approval.</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#F59E0B;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view and edit your request
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 5. RESUBMITTED - To Approver
export function getResubmittedEmail(
  applicantName: string
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366F1,#4f46e5);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">🔄 Request Resubmitted</h1>
      <p style="margin:8px 0 0;opacity:0.9;">${applicantName} has resubmitted their request</p>
    </div>
    <div style="padding:30px;">
      <p>Dear Approver,</p>
      <p><strong>${applicantName}</strong> has resubmitted their leave request after revision.</p>
      <p style="font-size:14px;color:#6b7280;">Please review the updated request.</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#6366F1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to review the updated request
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 6. COMP-OFF APPROVED - To Applicant
export function getCompOffApprovedEmail(
  applicantName: string,
  creditedDays: number,
  expiryDate: string
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#10B981,#059669);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">🎯 Comp-Off Approved</h1>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your compensatory off request has been <strong style="color:#10B981;">approved</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;"><strong>Credited Days:</strong></td><td>${creditedDays} day(s)</td></tr>
        <tr><td style="padding:8px 0;"><strong>Expiry Date:</strong></td><td>${new Date(expiryDate).toLocaleDateString()}</td></tr>
      </table>
      <p style="font-size:14px;color:#6b7280;">You can now apply for comp-off leave from your dashboard.</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#10B981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view your comp-off credits
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 7. COMP-OFF REJECTED - To Applicant
export function getCompOffRejectedEmail(applicantName: string): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#EF4444,#DC2626);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">❌ Comp-Off Rejected</h1>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your compensatory off request has been <strong style="color:#EF4444;">rejected</strong>.</p>
      <p style="font-size:14px;color:#6b7280;">Please contact your HOD for more information.</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#EF4444;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view the details
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 8. OVERWORK APPROVED - To Applicant
export function getOverworkApprovedEmail(
  applicantName: string,
  hours: number,
  earnedLeaveDays: number
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#F59E0B,#D97706);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">⏰ Overwork Approved</h1>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your overwork entry of <strong>${hours} hours</strong> has been <strong style="color:#F59E0B;">approved</strong>.</p>
      ${earnedLeaveDays > 0 ? `
        <div style="background-color:#D1FAE5;padding:16px;border-radius:8px;margin:16px 0;">
          <strong style="color:#065F46;">🎉 You earned ${earnedLeaveDays} comp-off day(s)!</strong>
          <p style="margin:8px 0 0;">The credits have been added to your comp-off balance.</p>
        </div>
      ` : `
        <p style="font-size:14px;color:#6b7280;">Keep tracking your overwork hours!</p>
      `}
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#F59E0B;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view your overwork history
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 9. OVERWORK REJECTED - To Applicant
export function getOverworkRejectedEmail(applicantName: string, hours: number): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#EF4444,#DC2626);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">❌ Overwork Rejected</h1>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your overwork entry of <strong>${hours} hours</strong> has been <strong style="color:#EF4444;">rejected</strong>.</p>
      <p style="font-size:14px;color:#6b7280;">Please contact your HOD for more information.</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#EF4444;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view the details
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 10. VACATION APPROVED - To Applicant
export function getVacationApprovedEmail(
  applicantName: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  paidDays: number,
  unpaidDays: number
): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#10B981,#059669);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">🌴 Vacation Approved</h1>
      <p style="margin:8px 0 0;opacity:0.9;">Enjoy your vacation!</p>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your vacation request has been <strong style="color:#10B981;">approved</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;"><strong>Dates:</strong></td><td>${new Date(startDate).toLocaleDateString()} → ${new Date(endDate).toLocaleDateString()}</td></tr>
        <tr><td style="padding:8px 0;"><strong>Total Days:</strong></td><td>${totalDays} day(s)</td></tr>
        <tr><td style="padding:8px 0;"><strong>Paid Days:</strong></td><td>${paidDays} day(s)</td></tr>
        <tr><td style="padding:8px 0;"><strong>Unpaid Days:</strong></td><td>${unpaidDays} day(s)</td></tr>
      </table>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#10B981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view your vacation status
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 11. VACATION REJECTED - To Applicant
export function getVacationRejectedEmail(applicantName: string, reason: string): string {
  const loginUrl = `${getAppUrl()}/login`;
  
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#EF4444,#DC2626);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">❌ Vacation Rejected</h1>
    </div>
    <div style="padding:30px;">
      <p>Dear ${applicantName},</p>
      <p>Your vacation request has been <strong style="color:#EF4444;">rejected</strong>.</p>
      <div style="background-color:#FEE2E2;padding:16px;border-radius:8px;margin:16px 0;">
        <strong>Rejection Reason:</strong>
        <p style="margin:8px 0 0;">${reason || "No reason provided"}</p>
      </div>
      <p style="font-size:14px;color:#6b7280;">You can submit a new request if needed.</p>
      <div style="text-align:center;margin-top:25px;">
        <a href="${loginUrl}" 
           style="display:inline-block;background:#EF4444;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Go to Login →
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:8px;">
          Please log in to view the details
        </p>
      </div>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}

// 12. PASSWORD RESET - To User
export function getPasswordResetEmailTemplate(resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#6366F1,#4f46e5);padding:30px;color:white;text-align:center;">
      <h1 style="margin:0;">🔐 Reset Password</h1>
      <p style="margin:8px 0 0;opacity:0.9;">UniLeave - University Leave Management</p>
    </div>
    <div style="padding:30px;">
      <p>We received a request to reset your UniLeave account password.</p>
      <p>Click the button below to create a new password:</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetLink}" 
           style="display:inline-block;background:#6366F1;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;">
          Reset Password
        </a>
      </div>
      <div style="background-color:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;margin:20px 0;border-radius:4px;">
        <p style="color:#92400e;font-size:14px;margin:0;">
          ⚠️ This link will expire in 1 hour. If you didn't request this, please ignore this email.
        </p>
      </div>
      <p style="font-size:12px;color:#6b7280;">
        For security, this link will expire in 1 hour.
      </p>
    </div>
    <div style="text-align:center;padding:20px;font-size:12px;color:#6b7280;">
      UniLeave • University Leave Management System
    </div>
  </div>
</body>
</html>
  `;
}