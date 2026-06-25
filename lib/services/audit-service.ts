// lib/services/audit-service.ts - FIXED
import { getRTDB } from "@/lib/firebase/admin";

export type AuditAction = 
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_RESTORED"
  | "USER_DELETED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_REMARKS_SENT"
  | "LEAVE_RESUBMITTED"
  | "LEAVE_CANCELLED"
  | "PRINCIPAL_OVERRIDE"
  | "COMP_OFF_APPROVED"
  | "COMP_OFF_REJECTED"
  | "OVERWORK_APPROVED"
  | "OVERWORK_REJECTED"
  | "VACATION_APPROVED"
  | "VACATION_REJECTED"
  | "POLICY_CREATED"
  | "POLICY_UPDATED"
  | "LEAVE_TYPE_CREATED"
  | "LEAVE_TYPE_UPDATED"
  | "LEAVE_TYPE_DELETED"
  | "OVERWORK_CONFIG_UPDATED"
  | "VACATION_PERIOD_CREATED"
  | "VACATION_PERIOD_UPDATED"
  | "VACATION_PERIOD_DELETED"
  | "HOD_ASSIGNED"
  | "PRINCIPAL_ASSIGNED"
  | "DEPARTMENT_CREATED"
  | "DEPARTMENT_UPDATED"
  | "DEPARTMENT_DELETED";

export type AuditModule =
  | "users"
  | "leaveRequests"
  | "compOffCredits"
  | "overworkEntries"
  | "leavePolicies"
  | "leaveTypes"
  | "overworkConfig"
  | "vacationPeriods"
  | "departments"
  | "colleges";

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  module: AuditModule;
  targetId: string | null;
  targetUser: string | null;
  oldData: string | null;
  newData: string | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CreateAuditLogParams {
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  module: AuditModule;
  targetId?: string;
  targetUser?: string;
  oldData?: unknown;
  newData?: unknown;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  action?: AuditAction;
  module?: AuditModule;
  userId?: string;
  limit?: number;
}

export async function createAuditLog({
  userId,
  userName,
  userRole,
  action,
  module,
  targetId,
  targetUser,
  oldData,
  newData,
  details,
  ipAddress,
  userAgent,
}: CreateAuditLogParams): Promise<string> {
  const rtdb = getRTDB();
  if (!rtdb) {
    console.warn("RTDB not initialized, skipping audit log");
    return "";
  }

  const logId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const auditLog: Omit<AuditLog, 'id'> = {
    userId,
    userName,
    userRole,
    action,
    module,
    targetId: targetId || null,
    targetUser: targetUser || null,
    oldData: oldData ? JSON.stringify(oldData) : null,
    newData: newData ? JSON.stringify(newData) : null,
    details: details ? JSON.stringify(details) : null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    createdAt: new Date().toISOString(),
  };

  try {
    await rtdb.ref(`auditLogs/${logId}`).set(auditLog);
    return logId;
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return "";
  }
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  const rtdb = getRTDB();
  if (!rtdb) return [];

  try {
    const snapshot = await rtdb.ref("auditLogs").once("value");
    const allLogs = snapshot.val() as Record<string, AuditLog> | null || {};
    
    let logs = Object.values(allLogs);
    
    if (filters.startDate) {
      logs = logs.filter((log) => log.createdAt >= filters.startDate!);
    }
    if (filters.endDate) {
      logs = logs.filter((log) => log.createdAt <= filters.endDate!);
    }
    if (filters.action) {
      logs = logs.filter((log) => log.action === filters.action);
    }
    if (filters.module) {
      logs = logs.filter((log) => log.module === filters.module);
    }
    if (filters.userId) {
      logs = logs.filter((log) => log.userId === filters.userId);
    }
    
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (filters.limit && filters.limit > 0) {
      logs = logs.slice(0, filters.limit);
    }
    
    return logs;
  } catch (error) {
    console.error("Failed to get audit logs:", error);
    return [];
  }
}