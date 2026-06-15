// lib/validations/vacation-schema.ts
import { z } from "zod";

export const vacationSchema = z.object({
  vacationPeriodId: z.string().min(1, "Please select a vacation period"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  alternateFacultyName: z.string()
    .min(3, "Alternate faculty name is required (minimum 3 characters)"),
  reason: z.string().optional(),
});

export type VacationFormData = z.infer<typeof vacationSchema>;

// Validation for vacation period dates
export function validateVacationDates(
  startDate: string,
  endDate: string,
  vacationStart: string,
  vacationEnd: string
): { isValid: boolean; error?: string; totalDays?: number; paidDays?: number; unpaidDays?: number; paidQuota?: number } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const vStart = new Date(vacationStart);
  const vEnd = new Date(vacationEnd);
  
  if (start < vStart || end > vEnd) {
    return { 
      isValid: false, 
      error: "Selected dates must be within the vacation period" 
    };
  }
  
  if (start > end) {
    return { isValid: false, error: "Start date must be before end date" };
  }
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  return { isValid: true, totalDays };
}