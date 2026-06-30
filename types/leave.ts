// types/leave.ts
export type LeaveType = "CL" | "EL" | "ML" | "CO" | "OD" | "MAT" | "PAT" | "SPL";

export type LeaveStatus =
  | "Draft"
  | "Pending_HOD"
  | "Pending_Registrar"
  | "Pending_Principal"
  | "Approved"
  | "Rejected_HOD"
  | "Rejected_Registrar"
  | "Rejected_Principal"
  | "Pending_Revision"
  | "Cancelled";

export interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

export interface LeaveBalancesDoc {
  userId: string;
  academicYear: string;
  balances: Record<string, LeaveBalance>;
  updatedAt: string;
}

export interface ODDetails {
  eventName: string;
  organization: string;
  location: string;
  purpose: string;
}

export interface CompOffCreditsUsed {
  creditId: string;
  daysUsed: number;
}

export interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantRoles: string[];
  departmentId: string;
  departmentName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  halfDaySession: "First Half" | "Second Half" | null;
  reason: string;
  alternateFacultyName: string;
  attachmentUrl: string | null;
  status: LeaveStatus;
  approvedBy: "hod" | "registrar" | "principal" | null;
  currentApproverId: string | null;
  revisionCount: number;
  overriddenBy: "principal" | null;
  overriddenAt: string | null;
  overrideReason: string | null;
  balanceRestored: boolean;
  createdAt: string;
  updatedAt: string;
  // ✅ NEW: OD specific details
  odDetails?: ODDetails;
  // ✅ NEW: Comp-off credit usage tracking
  compOffCreditsUsed?: CompOffCreditsUsed;
}

export interface RevisionHistory {
  id: string;
  leaveRequestId: string;
  cycleNumber: number;
  remarkSentBy: string;
  remarkSentByName: string;
  remarkText: string;
  resubmittedBy: string | null;
  resubmittedAt: string | null;
}

export interface ApprovalLog {
  id: string;
  leaveRequestId: string;
  actionBy: string;
  actionByName: string;
  actionRole: string;
  action: "SUBMIT" | "APPROVE" | "REJECT" | "SEND_REMARKS" | "RESUBMIT" | "CANCEL" | "PRINCIPAL_OVERRIDE";
  remark: string | null;
  oldStatus: LeaveStatus | null;
  newStatus: LeaveStatus;
  actionAt: string;
}

export interface CompOffCredit {
  id: string;
  userId: string;
  userName?: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: "active" | "expired" | "fully_used" | "pending_approval" | "pending_usage" | "rejected";
  approvedBy: string | null;
  approvedByName: string | null;
  approvalRemark: string | null;
  hoursWorked?: number;
  attachmentUrl?: string | null;
  requestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompOffUsage {
  id: string;
  creditId: string;
  leaveRequestId: string;
  userId: string;
  userName: string;
  daysUsed: number;
  usedAt: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}