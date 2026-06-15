// lib/validations/overwork-schema.ts
import { z } from "zod";

export const overworkSchema = z.object({
  workDate: z.string().min(1, "Work date is required"),
  hours: z.number()
    .min(0.5, "Hours must be at least 0.5")
    .max(24, "Hours cannot exceed 24 per day"),
  reason: z.string().optional(),
});

export type OverworkFormData = z.infer<typeof overworkSchema>;

// Configuration-based validation
export interface OverworkConfig {
  conversionHours: number;
  minHoursPerEntry: number;
  maxHoursPerDay: number;
  autoConversionEnabled: boolean;
}

export function validateOverworkWithConfig(
  hours: number, 
  config: OverworkConfig | null
): { isValid: boolean; error?: string } {
  if (!config) {
    return { isValid: false, error: "Overwork configuration not found" };
  }
  
  if (hours < config.minHoursPerEntry) {
    return { 
      isValid: false, 
      error: `Minimum hours per entry is ${config.minHoursPerEntry}` 
    };
  }
  
  if (hours > config.maxHoursPerDay) {
    return { 
      isValid: false, 
      error: `Maximum hours per day is ${config.maxHoursPerDay}` 
    };
  }
  
  return { isValid: true };
}