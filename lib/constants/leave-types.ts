// lib/constants/leave-types.ts

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
  CO: "Compensatory Off",
  OD: "On Duty",
  MAT: "Maternity Leave",
  PAT: "Paternity Leave",
  SPL: "Special Leave",
};

/**
 * Get the display label for a leave type code
 * @param type - The leave type code (e.g., "CL", "EL", "ML")
 * @returns The human-readable label
 */
export function getLeaveTypeLabel(type: string): string {
  return LEAVE_TYPE_LABELS[type] || type;
}

/**
 * Get color for a leave type (for badges, charts, etc.)
 */
export const LEAVE_TYPE_COLORS: Record<string, string> = {
  CL: "#6366F1", // Indigo
  EL: "#10B981", // Emerald
  ML: "#F59E0B", // Amber
  CO: "#EF4444", // Red
  OD: "#EC4899", // Pink
  MAT: "#14B8A6", // Teal
  PAT: "#F472B6", // Pink
  SPL: "#6B7280", // Gray
};

/**
 * Get CSS color for a leave type
 */
export function getLeaveTypeColor(type: string): string {
  return LEAVE_TYPE_COLORS[type] || "#6B7280";
}

/**
 * Get the badge variant for a leave type
 */
export function getLeaveTypeBadgeVariant(type: string): string {
  const variants: Record<string, string> = {
    CL: "default",
    EL: "secondary",
    ML: "destructive",
    CO: "outline",
    OD: "default",
    MAT: "secondary",
    PAT: "destructive",
    SPL: "outline",
  };
  return variants[type] || "default";
}

/**
 * Check if a leave type requires attachment
 */
export const LEAVE_TYPE_REQUIRES_ATTACHMENT: Record<string, boolean> = {
  CL: false,
  EL: false,
  ML: true,
  CO: true,
  OD: true,
  MAT: true,
  PAT: true,
  SPL: true,
};

export function doesLeaveTypeRequireAttachment(type: string): boolean {
  return LEAVE_TYPE_REQUIRES_ATTACHMENT[type] || false;
}

/**
 * Check if a leave type allows half day
 */
export const LEAVE_TYPE_ALLOWS_HALF_DAY: Record<string, boolean> = {
  CL: true,
  EL: true,
  ML: true,
  CO: false,
  OD: true,
  MAT: false,
  PAT: false,
  SPL: true,
};

export function doesLeaveTypeAllowHalfDay(type: string): boolean {
  return LEAVE_TYPE_ALLOWS_HALF_DAY[type] || false;
}

/**
 * Check if a leave type deducts from balance
 */
export const LEAVE_TYPE_DEDUCTS_BALANCE: Record<string, boolean> = {
  CL: true,
  EL: true,
  ML: true,
  CO: true,
  OD: false,
  MAT: true,
  PAT: true,
  SPL: true,
};

export function doesLeaveTypeDeductBalance(type: string): boolean {
  return LEAVE_TYPE_DEDUCTS_BALANCE[type] || false;
}

/**
 * Get all leave type codes
 */
export function getAllLeaveTypes(): string[] {
  return Object.keys(LEAVE_TYPE_LABELS);
}

/**
 * Get all leave type options for select dropdowns
 */
export function getLeaveTypeOptions(): { value: string; label: string }[] {
  return Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
}

/**
 * Check if a leave type is valid
 */
export function isValidLeaveType(type: string): boolean {
  return type in LEAVE_TYPE_LABELS;
}