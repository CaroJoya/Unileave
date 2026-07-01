// lib/services/leave-balance-service.ts - COMPLETE FIXED FILE
import { getRTDB } from "@/lib/firebase/admin";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import type { LeaveBalance, LeaveBalancesDoc } from "@/types/leave";

export const DEFAULT_QUOTAS: Record<string, Record<string, number>> = {
  faculty: { CL: 24, EL: 12, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
  lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
  office_staff: { CL: 20, EL: 10, ML: 15, CO: 8, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
  hod: { CL: 24, EL: 15, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
  registrar: { CL: 20, EL: 12, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
  principal: { CL: 30, EL: 20, ML: 15, CO: 12, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
  head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10, OD: 0, MAT: 180, PAT: 15, SPL: 10 },
};

export interface BalanceOperationResult {
  success: boolean;
  error?: string;
  balanceBefore?: LeaveBalance;
  balanceAfter?: LeaveBalance;
}

export async function getOrCreateLeaveBalance(
  userId: string,
  role: string,
  academicYear?: string
): Promise<LeaveBalancesDoc> {
  const rtdb = getRTDB();
  if (!rtdb) {
    throw new Error('Database not initialized');
  }

  const year = academicYear || getCurrentAcademicYear();
  const balanceKey = `${userId}_${year}`;
  const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
  const snapshot = await balanceRef.once("value");
  
  const roleQuota = DEFAULT_QUOTAS[role as keyof typeof DEFAULT_QUOTAS] || DEFAULT_QUOTAS.faculty;
  
  if (snapshot.exists()) {
    const data = snapshot.val() as LeaveBalancesDoc;
    let requiresUpdate = false;

    if (!data.balances) {
      data.balances = {};
      requiresUpdate = true;
    }

    // Enforce consistency for existing balances
    for (const [leaveType, quota] of Object.entries(roleQuota)) {
      if (!data.balances[leaveType]) {
        data.balances[leaveType] = { 
          available: quota, 
          pending: 0, 
          allocated: quota, 
          used: 0 
        };
        requiresUpdate = true;
      } else {
        // Fix: If allocated is missing or erroneously 0 (like the CL bug), forcefully restore it
        const balance = data.balances[leaveType];
        if (balance.allocated === undefined || balance.allocated === 0) {
          // Except for OD which legitimately has 0 allocated
          if (quota > 0) {
            balance.allocated = quota;
            requiresUpdate = true;
          }
        }
      }
    }
    
    if (requiresUpdate) {
      await balanceRef.update({ 
        balances: data.balances,
        updatedAt: new Date().toISOString()
      });
    }
    return data;
  }

  // Create new balance
  const balances: Record<string, LeaveBalance> = {};
  for (const [leaveType, quota] of Object.entries(roleQuota)) {
    balances[leaveType] = {
      available: quota,
      pending: 0,
      allocated: quota,
      used: 0
    };
  }

  const newBalanceDoc: LeaveBalancesDoc = {
    userId,
    academicYear: year,
    balances,
    updatedAt: new Date().toISOString(),
  };

  await balanceRef.set(newBalanceDoc);
  return newBalanceDoc;
}

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

export async function doesLeaveTypeDeductBalance(leaveType: string): Promise<boolean> {
  const rtdb = getRTDB();
  if (!rtdb) return true;

  try {
    const snapshot = await rtdb.ref('leaveTypes').once('value');
    const types = snapshot.val() as Record<string, { leaveCode: string; deductsBalance: boolean }> || {};
    
    for (const [, type] of Object.entries(types)) {
      if (type.leaveCode === leaveType) {
        return type.deductsBalance !== false;
      }
    }
    
    // CRITICAL FIX: OD explicitly returns false
    if (leaveType === 'OD') {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking leave type deducts balance:', error);
    if (leaveType === 'OD') {
      return false;
    }
    return true;
  }
}

export async function finalizeApproval(
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

  const balanceBefore = { ...currentBalance };
  
  // Clear pending and add to used
  const newPending = Math.max(0, (currentBalance.pending || 0) - days);
  const newUsed = (currentBalance.used || 0) + days;

  await balanceRef.update({
    [`balances.${leaveType}.pending`]: newPending,
    [`balances.${leaveType}.used`]: newUsed,
    updatedAt: new Date().toISOString(),
  });

  const balanceAfter = { ...currentBalance, pending: newPending, used: newUsed };
  return { success: true, balanceBefore, balanceAfter };
}