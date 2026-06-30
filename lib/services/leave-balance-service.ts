// lib/services/leave-balance-service.ts
import { getRTDB } from "@/lib/firebase/admin";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import type { LeaveBalance, LeaveBalancesDoc } from "@/types/leave";

const DEFAULT_QUOTAS: Record<string, Record<string, number>> = {
  faculty: { CL: 24, EL: 12, ML: 15, CO: 10 },
  lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8 },
  office_staff: { CL: 20, EL: 10, ML: 15, CO: 8 },
  hod: { CL: 24, EL: 15, ML: 15, CO: 10 },
  registrar: { CL: 20, EL: 12, ML: 15, CO: 10 },
  principal: { CL: 30, EL: 20, ML: 15, CO: 12 },
  head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10 },
};

export interface BalanceOperationResult {
  success: boolean;
  error?: string;
  balanceBefore?: LeaveBalance;
  balanceAfter?: LeaveBalance;
}

/**
 * Get or create a leave balance for a user
 */
export async function getOrCreateLeaveBalance(
  userId: string,
  userRole: string,
  academicYear?: string
): Promise<LeaveBalancesDoc | null> {
  const rtdb = getRTDB();
  if (!rtdb) return null;

  const year = academicYear || getCurrentAcademicYear();
  const balanceKey = `${userId}_${year}`;
  const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
  const snapshot = await balanceRef.once('value');
  let balanceDoc = snapshot.val() as LeaveBalancesDoc | null;

  if (!balanceDoc) {
    // Create new balance
    const quotas = DEFAULT_QUOTAS[userRole] || DEFAULT_QUOTAS.faculty;
    const balances: Record<string, LeaveBalance> = {};
    
    for (const [type, quota] of Object.entries(quotas)) {
      balances[type] = {
        allocated: quota,
        used: 0,
        pending: 0,
        available: quota,
      };
    }
    
    balanceDoc = {
      userId,
      academicYear: year,
      balances,
      updatedAt: new Date().toISOString(),
    };
    
    await balanceRef.set(balanceDoc);
  }

  return balanceDoc;
}

/**
 * Deduct leave from balance
 */
export async function deductLeaveBalance(
  userId: string,
  leaveType: string,
  days: number,
  academicYear?: string
): Promise<BalanceOperationResult> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: 'Database not initialized' };
  }

  const year = academicYear || getCurrentAcademicYear();
  const balanceKey = `${userId}_${year}`;
  const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
  const snapshot = await balanceRef.once('value');
  const balanceDoc = snapshot.val() as LeaveBalancesDoc | null;

  if (!balanceDoc) {
    return { success: false, error: 'Leave balance not found' };
  }

  const currentBalance = balanceDoc.balances[leaveType];
  if (!currentBalance) {
    return { success: false, error: `Leave type ${leaveType} not found in balance` };
  }

  if (currentBalance.available < days) {
    return { 
      success: false, 
      error: `Insufficient balance. Available: ${currentBalance.available}, Requested: ${days}` 
    };
  }

  const balanceBefore = { ...currentBalance };
  const newPending = (currentBalance.pending || 0) + days;
  const newAvailable = currentBalance.available - days;

  await balanceRef.update({
    [`balances.${leaveType}.pending`]: newPending,
    [`balances.${leaveType}.available`]: newAvailable,
    updatedAt: new Date().toISOString(),
  });

  const balanceAfter = { ...currentBalance, pending: newPending, available: newAvailable };

  return { success: true, balanceBefore, balanceAfter };
}

/**
 * Restore leave to balance (for rejection or cancellation)
 */
export async function restoreLeaveBalance(
  userId: string,
  leaveType: string,
  days: number,
  academicYear?: string
): Promise<BalanceOperationResult> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: 'Database not initialized' };
  }

  const year = academicYear || getCurrentAcademicYear();
  const balanceKey = `${userId}_${year}`;
  const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
  const snapshot = await balanceRef.once('value');
  const balanceDoc = snapshot.val() as LeaveBalancesDoc | null;

  if (!balanceDoc) {
    // If balance doesn't exist, create it with the restored days
    const userSnapshot = await rtdb.ref(`users/${userId}`).once('value');
    const userData = userSnapshot.val() as { roles?: string[] } | null;
    const userRole = userData?.roles?.[0] || 'faculty';
    
    const newBalance = await getOrCreateLeaveBalance(userId, userRole, year);
    if (!newBalance) {
      return { success: false, error: 'Failed to create leave balance' };
    }
    
    // Add the restored days to the balance
    const currentBalance = newBalance.balances[leaveType] || { allocated: 0, used: 0, pending: 0, available: 0 };
    const balanceBefore = { ...currentBalance };
    const newAvailable = (currentBalance.available || 0) + days;
    const newPending = Math.max(0, (currentBalance.pending || 0) - days);

    await balanceRef.update({
      [`balances.${leaveType}`]: {
        ...currentBalance,
        pending: newPending,
        available: newAvailable,
      },
      updatedAt: new Date().toISOString(),
    });

    const balanceAfter = { ...currentBalance, pending: newPending, available: newAvailable };
    return { success: true, balanceBefore, balanceAfter };
  }

  const currentBalance = balanceDoc.balances[leaveType];
  if (!currentBalance) {
    // Create the leave type in the balance
    const newBalance: LeaveBalance = {
      allocated: 0,
      used: 0,
      pending: 0,
      available: days,
    };
    
    await balanceRef.update({
      [`balances.${leaveType}`]: newBalance,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, balanceBefore: undefined, balanceAfter: newBalance };
  }

  const balanceBefore = { ...currentBalance };
  const newPending = Math.max(0, (currentBalance.pending || 0) - days);
  const newAvailable = (currentBalance.available || 0) + days;

  await balanceRef.update({
    [`balances.${leaveType}.pending`]: newPending,
    [`balances.${leaveType}.available`]: newAvailable,
    updatedAt: new Date().toISOString(),
  });

  const balanceAfter = { ...currentBalance, pending: newPending, available: newAvailable };

  return { success: true, balanceBefore, balanceAfter };
}

/**
 * Check if a leave type deducts balance
 */
export async function doesLeaveTypeDeductBalance(leaveType: string): Promise<boolean> {
  const rtdb = getRTDB();
  if (!rtdb) return true; // Default to true

  try {
    const snapshot = await rtdb.ref('leaveTypes').once('value');
    const types = snapshot.val() as Record<string, { leaveCode: string; deductsBalance: boolean }> || {};
    
    for (const [, type] of Object.entries(types)) {
      if (type.leaveCode === leaveType) {
        return type.deductsBalance !== false;
      }
    }
    return true; // Default to true if not found
  } catch (error) {
    console.error('Error checking leave type deducts balance:', error);
    return true;
  }
}