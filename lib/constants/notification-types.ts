// lib/constants/notification-types.ts
export enum NotificationType {
  // Leave related
  LEAVE_APPROVED = "leave_approved",
  LEAVE_REJECTED = "leave_rejected",
  LEAVE_REMARKS = "leave_remarks",
  LEAVE_RESUBMITTED = "leave_resubmitted",
  LEAVE_CANCELLED = "leave_cancelled",
  
  // Comp Off related
  COMPOFF_APPROVED = "comp_off_approved",
  COMPOFF_REJECTED = "comp_off_rejected",
  COMPOFF_AUTO_CREATED = "comp_off_auto_created",
  
  // Overwork related
  OVERWORK_APPROVED = "overwork_approved",
  OVERWORK_REJECTED = "overwork_rejected",
  
  // Vacation related
  VACATION_APPROVED = "vacation_approved",
  VACATION_REJECTED = "vacation_rejected",
  
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
}

export const NotificationTitles: Record<NotificationType, string> = {
  [NotificationType.LEAVE_APPROVED]: "Leave Request Approved",
  [NotificationType.LEAVE_REJECTED]: "Leave Request Rejected",
  [NotificationType.LEAVE_REMARKS]: "Leave Request Needs Revision",
  [NotificationType.LEAVE_RESUBMITTED]: "Leave Request Resubmitted",
  [NotificationType.LEAVE_CANCELLED]: "Leave Request Cancelled",
  [NotificationType.COMPOFF_APPROVED]: "Comp-Off Credit Approved",
  [NotificationType.COMPOFF_REJECTED]: "Comp-Off Request Rejected",
  [NotificationType.COMPOFF_AUTO_CREATED]: "New Comp-Off Credit",
  [NotificationType.OVERWORK_APPROVED]: "Overwork Hours Approved",
  [NotificationType.OVERWORK_REJECTED]: "Overwork Request Rejected",
  [NotificationType.VACATION_APPROVED]: "Vacation Request Approved",
  [NotificationType.VACATION_REJECTED]: "Vacation Request Rejected",
  [NotificationType.PRINCIPAL_OVERRIDE]: "Leave Request Overridden",
  [NotificationType.USER_CREATED]: "Account Created",
  [NotificationType.USER_RESTORED]: "Account Restored",
  [NotificationType.USER_DELETED]: "Account Deleted",
  [NotificationType.USER_DEACTIVATED]: "Account Deactivated",
  [NotificationType.POLICY_UPDATED]: "Leave Policy Updated",
  [NotificationType.LEAVE_TYPE_UPDATED]: "Leave Type Updated",
  [NotificationType.OVERWORK_CONFIG_UPDATED]: "Overwork Configuration Updated",
  [NotificationType.VACATION_PERIOD_UPDATED]: "Vacation Period Updated",
};