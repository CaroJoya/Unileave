// lib/utils/roles.ts
export function hasHeadClerkOrSuperAdminRights(roles: string[]): boolean {
  return roles.includes("head_clerk") || roles.includes("super_admin");
}

export function getPerformerRole(roles: string[]): string {
  return roles.includes("super_admin") ? "super_admin" : "head_clerk";
}