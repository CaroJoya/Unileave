// lib/constants/notification-types.ts
export enum NotificationType {
  // Leave related
  LEAVE_APPROVED = "leave_approved",
  LEAVE_REJECTED = "leave_rejected",
  LEAVE_REMARKS = "leave_remarks",
  LEAVE_RESUBMITTED = "leave_resubmitted",
  LEAVE_CANCELLED = "leave_cancelled",
  LEAVE_SUBMITTED = "leave_submitted",

  // Comp Off related
  COMPOFF_APPROVED = "comp_off_approved",
  COMPOFF_REJECTED = "comp_off_rejected",
  COMPOFF_AUTO_CREATED = "comp_off_auto_created",
  COMPOFF_SUBMITTED = "comp_off_submitted",

  // Overwork related
  OVERWORK_APPROVED = "overwork_approved",
  OVERWORK_REJECTED = "overwork_rejected",
  OVERWORK_SUBMITTED = "overwork_submitted",

  // Vacation related
  VACATION_APPROVED = "vacation_approved",
  VACATION_REJECTED = "vacation_rejected",
  VACATION_SUBMITTED = "vacation_submitted",

  // Principal Override
  PRINCIPAL_OVERRIDE = "principal_override",

  // User Management
  USER_CREATED = "user_created",
  USER_RESTORED = "user_restored",
  USER_DELETED = "user_deleted",
  USER_DEACTIVATED = "user_deactivated",

  // Policy changes
  POLICY_UPDATED = "policy_updated",
  LEAVE_TYPE_UPDATED = "leave_type_updated",
  OVERWORK_CONFIG_UPDATED = "overwork_config_updated",
  VACATION_PERIOD_UPDATED = "vacation_period_updated",

  // Year Reset
  YEAR_RESET = "year_reset",
  YEAR_RESET_CONFIRMED = "year_reset_confirmed",

  // Attendance
  ATTENDANCE_MARKED = "attendance_marked",
}

export const NotificationTitles: Record<NotificationType, string> = {
  [NotificationType.LEAVE_APPROVED]: "Leave Request Approved",
  [NotificationType.LEAVE_REJECTED]: "Leave Request Rejected",
  [NotificationType.LEAVE_REMARKS]: "Leave Request Needs Revision",
  [NotificationType.LEAVE_RESUBMITTED]: "Leave Request Resubmitted",
  [NotificationType.LEAVE_CANCELLED]: "Leave Request Cancelled",
  [NotificationType.LEAVE_SUBMITTED]: "Leave Request Submitted",

  [NotificationType.COMPOFF_APPROVED]: "Comp-Off Credit Approved",
  [NotificationType.COMPOFF_REJECTED]: "Comp-Off Request Rejected",
  [NotificationType.COMPOFF_AUTO_CREATED]: "New Comp-Off Credit",
  [NotificationType.COMPOFF_SUBMITTED]: "Comp-Off Request Submitted",

  [NotificationType.OVERWORK_APPROVED]: "Overwork Hours Approved",
  [NotificationType.OVERWORK_REJECTED]: "Overwork Request Rejected",
  [NotificationType.OVERWORK_SUBMITTED]: "Overwork Request Submitted",

  [NotificationType.VACATION_APPROVED]: "Vacation Request Approved",
  [NotificationType.VACATION_REJECTED]: "Vacation Request Rejected",
  [NotificationType.VACATION_SUBMITTED]: "Vacation Request Submitted",

  [NotificationType.PRINCIPAL_OVERRIDE]: "Leave Request Overridden",

  [NotificationType.USER_CREATED]: "Account Created",
  [NotificationType.USER_RESTORED]: "Account Restored",
  [NotificationType.USER_DELETED]: "Account Deleted",
  [NotificationType.USER_DEACTIVATED]: "Account Deactivated",

  [NotificationType.POLICY_UPDATED]: "Leave Policy Updated",
  [NotificationType.LEAVE_TYPE_UPDATED]: "Leave Type Updated",
  [NotificationType.OVERWORK_CONFIG_UPDATED]: "Overwork Configuration Updated",
  [NotificationType.VACATION_PERIOD_UPDATED]: "Vacation Period Updated",

  [NotificationType.YEAR_RESET]: "Academic Year Reset",
  [NotificationType.YEAR_RESET_CONFIRMED]: "Academic Year Reset Confirmed",

  [NotificationType.ATTENDANCE_MARKED]: "Attendance Marked",
};

export const NotificationDescriptions: Partial<Record<NotificationType, string>> = {
  [NotificationType.YEAR_RESET]: "The academic year has been reset. Your leave balances have been updated.",
  [NotificationType.YEAR_RESET_CONFIRMED]: "The academic year reset has been confirmed.",
};

export function getNotificationTypeFromAction(action: string): NotificationType | null {
  const mapping: Record<string, NotificationType> = {
    "LEAVE_APPROVED": NotificationType.LEAVE_APPROVED,
    "LEAVE_REJECTED": NotificationType.LEAVE_REJECTED,
    "LEAVE_REMARKS_SENT": NotificationType.LEAVE_REMARKS,
    "LEAVE_RESUBMITTED": NotificationType.LEAVE_RESUBMITTED,
    "LEAVE_CANCELLED": NotificationType.LEAVE_CANCELLED,
    "COMP_OFF_APPROVED": NotificationType.COMPOFF_APPROVED,
    "COMP_OFF_REJECTED": NotificationType.COMPOFF_REJECTED,
    "OVERWORK_APPROVED": NotificationType.OVERWORK_APPROVED,
    "OVERWORK_REJECTED": NotificationType.OVERWORK_REJECTED,
    "VACATION_APPROVED": NotificationType.VACATION_APPROVED,
    "VACATION_REJECTED": NotificationType.VACATION_REJECTED,
    "PRINCIPAL_OVERRIDE": NotificationType.PRINCIPAL_OVERRIDE,
    "POLICY_CREATED": NotificationType.POLICY_UPDATED,
    "POLICY_UPDATED": NotificationType.POLICY_UPDATED,
    "YEAR_RESET_EXECUTED": NotificationType.YEAR_RESET,
  };
  return mapping[action] || null;
}