// lib/validations/leave-request-schema.ts
import { z } from "zod";

export const leaveRequestSchema = z.object({
  leaveType: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  totalDays: z.number().min(0.5, "Total days must be at least 0.5"),
  isHalfDay: z.boolean().default(false),
  halfDaySession: z.enum(["First Half", "Second Half"]).optional().nullable(),
  reason: z.string().optional(),
  alternateFacultyName: z.string()
    .min(3, "Alternate faculty name is required (minimum 3 characters)")
    .max(100, "Alternate faculty name is too long"),
  attachmentUrl: z.string().nullable().optional(),
});

export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

// Validation for date range
export function validateDateRange(startDate: string, endDate?: string): { isValid: boolean; error?: string } {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  
  if (start > end) {
    return { isValid: false, error: "Start date cannot be after end date" };
  }
  
  return { isValid: true };
}

// Validation for half day session
export function validateHalfDaySession(isHalfDay: boolean, halfDaySession: string | null | undefined): { isValid: boolean; error?: string } {
  if (isHalfDay && !halfDaySession) {
    return { isValid: false, error: "Please select morning or afternoon session for half day leave" };
  }
  return { isValid: true };
}

// Validation for attachment requirement
export function validateAttachment(requiresAttachment: boolean, attachmentUrl: string | null | undefined): { isValid: boolean; error?: string } {
  if (requiresAttachment && !attachmentUrl) {
    return { isValid: false, error: "Attachment is required for this leave type" };
  }
  return { isValid: true };
}