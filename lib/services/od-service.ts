// lib/services/od-service.ts
import { getRTDB } from "@/lib/firebase/admin";
import type { ODDetails } from "@/types/leave";

export interface ODValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate OD details
 */
export function validateODDetails(odDetails: ODDetails): ODValidationResult {
  const errors: string[] = [];

  if (!odDetails.eventName || odDetails.eventName.trim().length < 3) {
    errors.push('Event name is required (minimum 3 characters)');
  }

  if (!odDetails.organization || odDetails.organization.trim().length < 2) {
    errors.push('Organization name is required');
  }

  if (!odDetails.location || odDetails.location.trim().length < 2) {
    errors.push('Location is required');
  }

  if (!odDetails.purpose || odDetails.purpose.trim().length < 5) {
    errors.push('Purpose description is required (minimum 5 characters)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a leave type requires OD details
 */
export async function doesLeaveTypeRequireODDetails(leaveType: string): Promise<boolean> {
  const rtdb = getRTDB();
  if (!rtdb) return false;

  try {
    const snapshot = await rtdb.ref('leaveTypes').once('value');
    const types = snapshot.val() as Record<string, { leaveCode: string; requiresEventDetails: boolean }> || {};
    
    for (const [, type] of Object.entries(types)) {
      if (type.leaveCode === leaveType) {
        return type.requiresEventDetails === true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking OD details requirement:', error);
    return false;
  }
}

/**
 * Check if a leave type requires attachment
 */
export async function doesLeaveTypeRequireAttachment(leaveType: string): Promise<boolean> {
  const rtdb = getRTDB();
  if (!rtdb) return false;

  try {
    const snapshot = await rtdb.ref('leaveTypes').once('value');
    const types = snapshot.val() as Record<string, { leaveCode: string; requiresAttachment: boolean }> || {};
    
    for (const [, type] of Object.entries(types)) {
      if (type.leaveCode === leaveType) {
        return type.requiresAttachment === true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking attachment requirement:', error);
    return false;
  }
}