// types/roles.ts
export type Role = 
  | "super_admin"
  | "head_clerk"
  | "registrar"
  | "principal"
  | "hod"
  | "faculty"
  | "lab_assistant"
  | "office_staff";

// ✅ FIXED: Principal now has higher priority than HOD
export const ROLE_PRIORITY: Record<Role, number> = {
  super_admin: 1,      // Highest priority
  head_clerk: 2,
  principal: 3,        // ✅ Principal now priority 3 (was 3, but now before HOD)
  registrar: 4,        // ✅ Registrar priority 4
  hod: 4,              // ✅ HOD same as Registrar (was 3)
  faculty: 5,
  lab_assistant: 5,
  office_staff: 5,
};

export function getHighestPriorityRole(roles: Role[]): Role | null {
  if (!roles.length) return null;
  return roles.reduce((highest, current) => 
    ROLE_PRIORITY[current] < ROLE_PRIORITY[highest] ? current : highest
  );
}

// Helper to check if user has a specific role
export function hasRole(roles: Role[], role: Role): boolean {
  return roles.includes(role);
}

// Helper to check if user has any of the given roles
export function hasAnyRole(roles: Role[], targetRoles: Role[]): boolean {
  return targetRoles.some(role => roles.includes(role));
}