// lib/utils/role-unassignment.ts
import { getRTDB } from "@/lib/firebase/admin";

// Types
interface Department {
  id?: string;
  name?: string;
  hodId?: string | null;
  hodName?: string | null;
  registrarId?: string | null;
  registrarName?: string | null;
  headClerkId?: string | null;
  headClerkName?: string | null;
  isActive?: boolean;
  collegeId?: string;
  collegeName?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
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

export interface UnassignmentResult {
  success: boolean;
  unassignments: string[];
  error?: string;
}

export async function unassignAllRoles(
  userId: string,
  userRoles: string[],
  userData: {
    departmentId?: string;
    collegeId?: string;
    name?: string;
  }
): Promise<UnassignmentResult> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return {
      success: false,
      unassignments: [],
      error: "Database not initialized",
    };
  }

  const unassignmentLogs: string[] = [];

  // 1. Check if user is HOD
  if (userRoles.includes("hod") && userData.departmentId) {
    try {
      const deptSnapshot = await rtdb
        .ref(`departments/${userData.departmentId}`)
        .once("value");
      const dept: Department | null = deptSnapshot.val();

      if (dept && dept.hodId === userId) {
        await rtdb.ref(`departments/${userData.departmentId}`).update({
          hodId: null,
          hodName: null,
          updatedAt: new Date().toISOString(),
        });
        unassignmentLogs.push(
          `Unassigned HOD from department "${dept.name || userData.departmentId}"`
        );
      }
    } catch (error) {
      console.error("Error unassigning HOD:", error);
    }
  }

  // 2. Check if user is Registrar - USING DEDICATED FIELD
  if (userRoles.includes("registrar") && userData.departmentId) {
    try {
      const deptSnapshot = await rtdb
        .ref(`departments/${userData.departmentId}`)
        .once("value");
      const dept: Department | null = deptSnapshot.val();

      // Check both the new registrarId field and legacy hodId for backward compatibility
      const isOffice = dept?.name?.toLowerCase() === "office";
      const isRegistrarInDept = dept && (
        dept.registrarId === userId || 
        (isOffice && dept.hodId === userId)
      );

      if (isRegistrarInDept) {
        // Use the new fields
        const updateData: Partial<Department> = {
          updatedAt: new Date().toISOString(),
        };

        // Clear registrar fields if they exist
        if (dept && dept.registrarId !== undefined) {
          updateData.registrarId = null;
          updateData.registrarName = null;
        }

        // Also clear hod fields if this was a legacy Office department
        if (dept && isOffice && dept.hodId === userId) {
          updateData.hodId = null;
          updateData.hodName = null;
        }

        await rtdb.ref(`departments/${userData.departmentId}`).update(updateData);
        unassignmentLogs.push(
          `Unassigned Registrar from department "${dept?.name || userData.departmentId}"`
        );
      }
    } catch (error) {
      console.error("Error unassigning Registrar:", error);
    }
  }

  // 3. Check if user is Principal
  if (userRoles.includes("principal") && userData.collegeId) {
    try {
      const collegeSnapshot = await rtdb
        .ref(`colleges/${userData.collegeId}`)
        .once("value");
      const college: College | null = collegeSnapshot.val();

      if (college && college.principalId === userId) {
        await rtdb.ref(`colleges/${userData.collegeId}`).update({
          principalId: null,
          principalName: null,
          updatedAt: new Date().toISOString(),
        });
        unassignmentLogs.push(
          `Unassigned Principal from college "${college.name || userData.collegeId}"`
        );
      }
    } catch (error) {
      console.error("Error unassigning Principal:", error);
    }
  }

  // 4. Check if user is Head Clerk (if needed)
  if (userRoles.includes("head_clerk") && userData.departmentId) {
    try {
      const deptSnapshot = await rtdb
        .ref(`departments/${userData.departmentId}`)
        .once("value");
      const dept: Department | null = deptSnapshot.val();

      // If your schema has a headClerkId field
      if (dept && dept.headClerkId === userId) {
        await rtdb.ref(`departments/${userData.departmentId}`).update({
          headClerkId: null,
          headClerkName: null,
          updatedAt: new Date().toISOString(),
        });
        unassignmentLogs.push(
          `Unassigned Head Clerk from department "${dept.name || userData.departmentId}"`
        );
      }
    } catch (error) {
      console.error("Error unassigning Head Clerk:", error);
    }
  }

  return {
    success: true,
    unassignments: unassignmentLogs,
  };
}