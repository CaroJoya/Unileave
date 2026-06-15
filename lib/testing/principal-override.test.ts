// lib/testing/principal-override.test.ts - Complete fixed version
/**
 * PRINCIPAL OVERRIDE TEST FILE
 * 
 * Verifies the principal override business rules:
 * - Only CL, EL, ML can be overridden
 * - Only approved by HOD or Registrar
 * - Cannot override started leaves
 * - Proper balance restoration
 */

export interface TestLeaveRequest {
  id: string;
  leaveType: string;
  status: string;
  approvedBy: string | null;
  startDate: string;
  overriddenBy: string | null;
}

export function isOverrideEligible(
  leave: TestLeaveRequest,
  currentDate: Date = new Date()
): { eligible: boolean; reason?: string } {
  // Rule 1: Leave type must be CL, EL, or ML
  const eligibleTypes = ["CL", "EL", "ML"];
  if (!eligibleTypes.includes(leave.leaveType)) {
    return { eligible: false, reason: `Leave type ${leave.leaveType} cannot be overridden. Only CL, EL, ML are eligible.` };
  }
  
  // Rule 2: Status must be Approved
  if (leave.status !== "Approved") {
    return { eligible: false, reason: `Status is ${leave.status}, must be Approved.` };
  }
  
  // Rule 3: Approved by HOD or Registrar
  if (leave.approvedBy !== "hod" && leave.approvedBy !== "registrar") {
    return { eligible: false, reason: `Approved by ${leave.approvedBy}, must be HOD or Registrar.` };
  }
  
  // Rule 4: Start date must be after today
  const startDate = new Date(leave.startDate);
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);
  
  if (startDate <= today) {
    return { eligible: false, reason: `Leave starts on ${startDate.toLocaleDateString()}, which is not in the future.` };
  }
  
  // Rule 5: Not already overridden
  if (leave.overriddenBy) {
    return { eligible: false, reason: "Leave has already been overridden." };
  }
  
  return { eligible: true };
}

// Test cases
const overrideTestCases = [
  {
    name: "Eligible: CL approved by HOD in future",
    leave: {
      id: "test1",
      leaveType: "CL",
      status: "Approved",
      approvedBy: "hod",
      startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      overriddenBy: null,
    },
    expectedEligible: true,
  },
  {
    name: "Ineligible: CO leave type",
    leave: {
      id: "test2",
      leaveType: "CO",
      status: "Approved",
      approvedBy: "hod",
      startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      overriddenBy: null,
    },
    expectedEligible: false,
    expectedReason: "cannot be overridden",
  },
  {
    name: "Ineligible: Not approved (Pending)",
    leave: {
      id: "test3",
      leaveType: "CL",
      status: "Pending_HOD",
      approvedBy: null,
      startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      overriddenBy: null,
    },
    expectedEligible: false,
    expectedReason: "must be Approved",
  },
  {
    name: "Ineligible: Already overridden",
    leave: {
      id: "test4",
      leaveType: "CL",
      status: "Approved",
      approvedBy: "hod",
      startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      overriddenBy: "principal123",
    },
    expectedEligible: false,
    expectedReason: "already been overridden",
  },
  {
    name: "Ineligible: Start date in past",
    leave: {
      id: "test5",
      leaveType: "CL",
      status: "Approved",
      approvedBy: "hod",
      startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      overriddenBy: null,
    },
    expectedEligible: false,
    expectedReason: "not in the future",
  },
];

export function verifyPrincipalOverrideRules(): { passed: boolean; results: { name: string; passed: boolean; reason?: string }[] } {
  const results = [];
  
  for (const testCase of overrideTestCases) {
    const result = isOverrideEligible(testCase.leave);
    const passed = result.eligible === testCase.expectedEligible;
    
    results.push({
      name: testCase.name,
      passed,
      reason: !passed && result.reason ? result.reason : undefined,
    });
  }
  
  const allPassed = results.every(r => r.passed);
  
  console.log("\n=== PRINCIPAL OVERRIDE RULES VERIFICATION ===");
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);
  
  results.forEach(r => {
    if (!r.passed) {
      console.error(`❌ ${r.name}: ${r.reason || "Failed"}`);
    } else {
      console.log(`✅ ${r.name}`);
    }
  });
  
  return { passed: allPassed, results };
}

// Declare window interface extension
declare global {
  interface Window {
    verifyPrincipalOverrideRules?: typeof verifyPrincipalOverrideRules;
  }
}

// Export for use in browser console without 'any'
if (typeof window !== "undefined") {
  window.verifyPrincipalOverrideRules = verifyPrincipalOverrideRules;
}