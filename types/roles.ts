export type Role = 
  | "super_admin"
  | "head_clerk"
  | "registrar"
  | "principal"
  | "hod"
  | "faculty"
  | "lab_assistant"
  | "office_staff";

export const ROLE_PRIORITY: Record<Role, number> = {
  super_admin: 1,
  head_clerk: 2,
  registrar: 3,
  principal: 3,
  hod: 3,
  faculty: 4,
  lab_assistant: 4,
  office_staff: 4,
};

export function getHighestPriorityRole(roles: Role[]): Role | null {
  if (!roles.length) return null;
  return roles.reduce((highest, current) => 
    ROLE_PRIORITY[current] < ROLE_PRIORITY[highest] ? current : highest
  );
}