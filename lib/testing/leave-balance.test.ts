// lib/testing/leave-balance.test.ts - Complete fixed version
/**
 * LEAVE BALANCE TEST FILE
 * 
 * Verifies leave balance calculations for:
 * - Approval (used increases, available decreases)
 * - Rejection (balance unchanged)
 * - Override (used decreases, available increases)
 */

export interface LeaveBalance {
  allocated: number;
  used: number;
  available: number;
}

export interface BalanceValidationResult {
  valid: boolean;
  errors: string[];
}

export function verifyApprovalBalanceChange(
  before: LeaveBalance,
  daysRequested: number,
  after: LeaveBalance
): BalanceValidationResult {
  const errors: string[] = [];
  
  const expectedUsed = before.used + daysRequested;
  const expectedAvailable = before.available - daysRequested;
  
  if (after.used !== expectedUsed) {
    errors.push(`Used: expected ${expectedUsed}, got ${after.used}`);
  }
  
  if (after.available !== expectedAvailable) {
    errors.push(`Available: expected ${expectedAvailable}, got ${after.available}`);
  }
  
  if (after.allocated !== before.allocated) {
    errors.push(`Allocated changed from ${before.allocated} to ${after.allocated}`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function verifyRejectionBalanceChange(
  before: LeaveBalance,
  _daysRequested: number, // Prefix with underscore to indicate intentionally unused
  after: LeaveBalance
): BalanceValidationResult {
  const errors: string[] = [];
  
  // On rejection, balance should remain unchanged
  if (after.used !== before.used) {
    errors.push(`Used changed from ${before.used} to ${after.used}`);
  }
  
  if (after.available !== before.available) {
    errors.push(`Available changed from ${before.available} to ${after.available}`);
  }
  
  if (after.allocated !== before.allocated) {
    errors.push(`Allocated changed from ${before.allocated} to ${after.allocated}`);
  }
  
  return { valid: errors.length === 0, errors };
}

export function verifyOverrideBalanceChange(
  before: LeaveBalance,
  daysRequested: number,
  after: LeaveBalance
): BalanceValidationResult {
  const errors: string[] = [];
  
  // On override, used decreases and available increases
  const expectedUsed = before.used - daysRequested;
  const expectedAvailable = before.available + daysRequested;
  
  if (after.used !== expectedUsed) {
    errors.push(`Used: expected ${expectedUsed}, got ${after.used}`);
  }
  
  if (after.available !== expectedAvailable) {
    errors.push(`Available: expected ${expectedAvailable}, got ${after.available}`);
  }
  
  if (after.allocated !== before.allocated) {
    errors.push(`Allocated changed from ${before.allocated} to ${after.allocated}`);
  }
  
  return { valid: errors.length === 0, errors };
}

export interface BalanceTestResults {
  approval: boolean;
  rejection: boolean;
  override: boolean;
}

// Test cases
export function runLeaveBalanceTests(): BalanceTestResults {
  console.log("\n=== LEAVE BALANCE VERIFICATION ===");
  
  // Approval test
  const approvalBefore: LeaveBalance = { allocated: 24, used: 5, available: 19 };
  const approvalAfter: LeaveBalance = { allocated: 24, used: 8, available: 16 };
  const approvalResult = verifyApprovalBalanceChange(approvalBefore, 3, approvalAfter);
  const approvalPassed = approvalResult.valid;
  console.log(approvalPassed ? "✅ Approval balance test passed" : `❌ Approval balance test failed: ${approvalResult.errors.join(", ")}`);
  
  // Rejection test
  const rejectionBefore: LeaveBalance = { allocated: 24, used: 5, available: 19 };
  const rejectionAfter: LeaveBalance = { allocated: 24, used: 5, available: 19 };
  const rejectionResult = verifyRejectionBalanceChange(rejectionBefore, 3, rejectionAfter);
  const rejectionPassed = rejectionResult.valid;
  console.log(rejectionPassed ? "✅ Rejection balance test passed" : `❌ Rejection balance test failed: ${rejectionResult.errors.join(", ")}`);
  
  // Override test
  const overrideBefore: LeaveBalance = { allocated: 24, used: 8, available: 16 };
  const overrideAfter: LeaveBalance = { allocated: 24, used: 5, available: 19 };
  const overrideResult = verifyOverrideBalanceChange(overrideBefore, 3, overrideAfter);
  const overridePassed = overrideResult.valid;
  console.log(overridePassed ? "✅ Override balance test passed" : `❌ Override balance test failed: ${overrideResult.errors.join(", ")}`);
  
  return {
    approval: approvalPassed,
    rejection: rejectionPassed,
    override: overridePassed,
  };
}

// Declare window interface extension
declare global {
  interface Window {
    runLeaveBalanceTests?: typeof runLeaveBalanceTests;
  }
}

// Export for use in browser console without 'any'
if (typeof window !== "undefined") {
  window.runLeaveBalanceTests = runLeaveBalanceTests;
}

// Run if directly executed (for Node testing)
if (typeof require !== "undefined" && typeof module !== "undefined" && module.parent === null) {
  runLeaveBalanceTests();
}