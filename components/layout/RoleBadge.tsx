// components/layout/RoleBadge.tsx
"use client";

import { Role, ROLE_PRIORITY } from "@/types/roles";

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  head_clerk: "Head Clerk",
  principal: "Principal",
  registrar: "Registrar",
  hod: "HOD",
  faculty: "Faculty",
  lab_assistant: "Lab Assistant",
  office_staff: "Office Staff",
};

const roleColors: Record<Role, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  head_clerk: "bg-amber-100 text-amber-700",
  principal: "bg-indigo-100 text-indigo-700",
  registrar: "bg-emerald-100 text-emerald-700",
  hod: "bg-blue-100 text-blue-700",
  faculty: "bg-gray-100 text-gray-700",
  lab_assistant: "bg-gray-100 text-gray-700",
  office_staff: "bg-gray-100 text-gray-700",
};

interface RoleBadgeProps {
  roles: Role[];
}

export function RoleBadge({ roles }: RoleBadgeProps) {
  if (!roles || roles.length === 0) return null;

  // Find highest priority role (lower number = higher priority)
  // ✅ FIXED: Principal now has higher priority than HOD
  const highestRole = roles.reduce((highest, current) => {
    // If current has higher priority (lower number), it becomes the highest
    return ROLE_PRIORITY[current] < ROLE_PRIORITY[highest] ? current : highest;
  });

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[highestRole]}`}>
      {roleLabels[highestRole]}
    </span>
  );
}