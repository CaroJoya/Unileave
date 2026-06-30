// lib/utils/validate-assignments.ts
import { getRTDB } from "@/lib/firebase/admin";

// Types
interface Department {
  id?: string;
  name?: string;
  hodId?: string | null;
  hodName?: string | null;
  registrarId?: string | null;
  registrarName?: string | null;
  isActive?: boolean;
  collegeId?: string;
  collegeName?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  uid?: string;
  name?: string;
  email?: string;
  roles?: string[];
  status?: string;
  departmentId?: string;
  departmentName?: string;
  collegeId?: string;
  collegeName?: string;
  isEmployed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

interface College {
  id?: string;
  name?: string;
  principalId?: string | null;
  principalName?: string | null;
  address?: string;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ValidationResult {
  errors: string[];
  cleaned: string[];
  details: {
    invalidHODs: number;
    invalidRegistrars: number;
    invalidPrincipals: number;
  };
}

export async function validateAndCleanAssignments(): Promise<ValidationResult> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return {
      errors: ["Database not initialized"],
      cleaned: [],
      details: { invalidHODs: 0, invalidRegistrars: 0, invalidPrincipals: 0 },
    };
  }

  const errors: string[] = [];
  const cleaned: string[] = [];
  let invalidHODs = 0;
  let invalidRegistrars = 0;
  let invalidPrincipals = 0;

  try {
    // 1. Get all departments
    const deptsSnapshot = await rtdb.ref("departments").once("value");
    const departments: Record<string, Department> = deptsSnapshot.val() || {};

    // 2. Get all users
    const usersSnapshot = await rtdb.ref("users").once("value");
    const users: Record<string, User> = usersSnapshot.val() || {};

    // Helper to check if user exists and is active
    const isValidUser = (userId: string): boolean => {
      const user = users[userId];
      return user && user.status !== "deleted";
    };

    for (const [deptId, deptData] of Object.entries(departments)) {
      const dept: Department = deptData;
      const deptName = dept.name || deptId;

      // Check HOD
      if (dept.hodId) {
        if (!isValidUser(dept.hodId)) {
          errors.push(`Department "${deptName}" has invalid HOD: ${dept.hodId}`);
          invalidHODs++;
          // Clean up
          await rtdb.ref(`departments/${deptId}`).update({
            hodId: null,
            hodName: null,
            updatedAt: new Date().toISOString(),
          });
          cleaned.push(`Cleared invalid HOD from "${deptName}"`);
        }
      }

      // Check Registrar (using new field)
      if (dept.registrarId) {
        if (!isValidUser(dept.registrarId)) {
          errors.push(`Department "${deptName}" has invalid Registrar: ${dept.registrarId}`);
          invalidRegistrars++;
          await rtdb.ref(`departments/${deptId}`).update({
            registrarId: null,
            registrarName: null,
            updatedAt: new Date().toISOString(),
          });
          cleaned.push(`Cleared invalid Registrar from "${deptName}"`);
        }
      }

      // Legacy check: If department is "Office" and has hodId that's actually a Registrar
      if (dept.name?.toLowerCase() === "office" && dept.hodId) {
        const user = users[dept.hodId];
        if (user && user.roles?.includes("registrar")) {
          // Migrate to new fields
          await rtdb.ref(`departments/${deptId}`).update({
            registrarId: dept.hodId,
            registrarName: dept.hodName,
            hodId: null,
            hodName: null,
            updatedAt: new Date().toISOString(),
          });
          cleaned.push(`Migrated Registrar from legacy hodId field in "${deptName}"`);
        }
      }
    }

    // 3. Check College Principals
    const collegesSnapshot = await rtdb.ref("colleges").once("value");
    const colleges: Record<string, College> = collegesSnapshot.val() || {};

    for (const [collegeId, collegeData] of Object.entries(colleges)) {
      const college: College = collegeData;
      const collegeName = college.name || collegeId;

      if (college.principalId) {
        if (!isValidUser(college.principalId)) {
          errors.push(`College "${collegeName}" has invalid Principal: ${college.principalId}`);
          invalidPrincipals++;
          await rtdb.ref(`colleges/${collegeId}`).update({
            principalId: null,
            principalName: null,
            updatedAt: new Date().toISOString(),
          });
          cleaned.push(`Cleared invalid Principal from "${collegeName}"`);
        }
      }
    }
  } catch (error) {
    console.error("Error validating assignments:", error);
    errors.push(`Validation error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  return {
    errors,
    cleaned,
    details: {
      invalidHODs,
      invalidRegistrars,
      invalidPrincipals,
    },
  };
}