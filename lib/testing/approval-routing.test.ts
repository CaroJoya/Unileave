// lib/testing/approval-routing.test.ts - Complete fixed version
/**
 * APPROVAL ROUTING TEST FILE
 * 
 * This file contains the business rule verification tests for approval routing.
 * Run these tests to verify the routing matrix is working correctly.
 */

import { determineApprover, getStatusForApprover } from "@/lib/utils/routing";
import type { Role } from "@/types/roles";

// Test Cases
const routingTestCases = [
  {
    name: "Faculty → HOD",
    roles: ["faculty"] as Role[],
    leaveType: "CL",
    expectedApprover: "hod" as const,
    expectedStatus: "Pending_HOD" as const,
  },
  {
    name: "Lab Assistant → HOD",
    roles: ["lab_assistant"] as Role[],
    leaveType: "CL",
    expectedApprover: "hod" as const,
    expectedStatus: "Pending_HOD" as const,
  },
  {
    name: "Office Staff → Registrar",
    roles: ["office_staff"] as Role[],
    leaveType: "CL",
    expectedApprover: "registrar" as const,
    expectedStatus: "Pending_Registrar" as const,
  },
  {
    name: "Head Clerk + Office Staff → Registrar",
    roles: ["head_clerk", "office_staff"] as Role[],
    leaveType: "CL",
    expectedApprover: "registrar" as const,
    expectedStatus: "Pending_Registrar" as const,
  },
  {
    name: "Registrar + Office Staff → Principal",
    roles: ["registrar", "office_staff"] as Role[],
    leaveType: "CL",
    expectedApprover: "principal" as const,
    expectedStatus: "Pending_Principal" as const,
  },
  {
    name: "HOD + Faculty → Principal",
    roles: ["hod", "faculty"] as Role[],
    leaveType: "CL",
    expectedApprover: "principal" as const,
    expectedStatus: "Pending_Principal" as const,
  },
  {
    name: "HOD + Lab Assistant → Principal",
    roles: ["hod", "lab_assistant"] as Role[],
    leaveType: "CL",
    expectedApprover: "principal" as const,
    expectedStatus: "Pending_Principal" as const,
  },
];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface VerificationResult {
  passed: boolean;
  results: TestResult[];
}

export function verifyApprovalRouting(): VerificationResult {
  const results: TestResult[] = [];
  
  for (const testCase of routingTestCases) {
    try {
      const route = determineApprover(testCase.roles, testCase.leaveType);
      const status = getStatusForApprover(route.firstApproverRole);
      
      const passed = route.firstApproverRole === testCase.expectedApprover && 
                     status === testCase.expectedStatus;
      
      results.push({
        name: testCase.name,
        passed,
        error: passed ? undefined : `Expected ${testCase.expectedApprover}/${testCase.expectedStatus}, got ${route.firstApproverRole}/${status}`,
      });
    } catch (error) {
      results.push({
        name: testCase.name,
        passed: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  
  const allPassed = results.every(r => r.passed);
  
  console.log("\n=== APPROVAL ROUTING VERIFICATION ===");
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);
  
  results.forEach(r => {
    if (!r.passed) {
      console.error(`❌ ${r.name}: ${r.error}`);
    } else {
      console.log(`✅ ${r.name}`);
    }
  });
  
  return { passed: allPassed, results };
}

// Declare window interface extension
declare global {
  interface Window {
    verifyApprovalRouting?: typeof verifyApprovalRouting;
  }
}

// Export for use in browser console without 'any'
if (typeof window !== "undefined") {
  window.verifyApprovalRouting = verifyApprovalRouting;
}

// Run if directly executed (for Node testing)
if (typeof require !== "undefined" && typeof module !== "undefined" && module.parent === null) {
  verifyApprovalRouting();
}