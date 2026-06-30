// lib/services/comp-off-service.ts
import { getRTDB } from "@/lib/firebase/admin";
import type { CompOffCredit } from "@/types/leave";

export interface CompOffBalance {
  totalAvailable: number;
  credits: CompOffCredit[];
  expiringSoon: CompOffCredit[];
}

/**
 * Get available comp-off credits for a user
 */
export async function getAvailableCompOffCredits(userId: string): Promise<CompOffCredit[]> {
  const rtdb = getRTDB();
  if (!rtdb) return [];

  try {
    const snapshot = await rtdb.ref('compOffCredits').once('value');
    const allCredits = snapshot.val() as Record<string, CompOffCredit> || {};
    
    const now = new Date();
    const userCredits = Object.entries(allCredits)
      .filter(([, credit]) => {
        return credit.userId === userId && 
               credit.status === 'active' &&
               new Date(credit.expiryDate) > now &&
               (credit.creditedDays - credit.usedDays) > 0;
      })
      .map(([id, credit]) => ({
        ...credit,
        id,
      }));
    
    // Sort by expiry date (soonest first)
    userCredits.sort((a, b) => 
      new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    );
    
    return userCredits;
  } catch (error) {
    console.error('Error fetching comp-off credits:', error);
    return [];
  }
}

/**
 * Get total available comp-off days for a user
 */
export async function getTotalCompOffBalance(userId: string): Promise<number> {
  const credits = await getAvailableCompOffCredits(userId);
  return credits.reduce((sum, credit) => sum + (credit.creditedDays - credit.usedDays), 0);
}

/**
 * Get comp-off credits expiring soon (within 30 days)
 */
export async function getExpiringCompOffCredits(userId: string): Promise<CompOffCredit[]> {
  const credits = await getAvailableCompOffCredits(userId);
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return credits.filter(credit => 
    new Date(credit.expiryDate) <= thirtyDaysFromNow
  );
}

/**
 * Use a comp-off credit (deduct days)
 */
export async function useCompOffCredit(
  creditId: string, 
  daysToUse: number,
  leaveRequestId: string
): Promise<{ success: boolean; error?: string }> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: 'Database not initialized' };
  }

  try {
    const creditRef = rtdb.ref(`compOffCredits/${creditId}`);
    const snapshot = await creditRef.once('value');
    const credit = snapshot.val() as CompOffCredit | null;

    if (!credit) {
      return { success: false, error: 'Credit not found' };
    }

    if (credit.status !== 'active') {
      return { success: false, error: `Credit is ${credit.status}. Cannot use.` };
    }

    const availableDays = credit.creditedDays - credit.usedDays;
    if (availableDays < daysToUse) {
      return { 
        success: false, 
        error: `Insufficient credit. Available: ${availableDays}, Requested: ${daysToUse}` 
      };
    }

    const newUsedDays = credit.usedDays + daysToUse;
    const isFullyUsed = newUsedDays >= credit.creditedDays;

    await creditRef.update({
      usedDays: newUsedDays,
      status: isFullyUsed ? 'fully_used' : 'active',
      updatedAt: new Date().toISOString(),
    });

    // Log usage
    const usageId = `co_usage_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await rtdb.ref(`compOffUsage/${usageId}`).set({
      id: usageId,
      creditId,
      leaveRequestId,
      userId: credit.userId,
      daysUsed: daysToUse,
      usedAt: new Date().toISOString(),
      status: 'approved',
    });

    return { success: true };
  } catch (error) {
    console.error('Error using comp-off credit:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Expire comp-off credits (run daily)
 */
export async function expireCompOffCredits(): Promise<{ expired: number; errors: string[] }> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { expired: 0, errors: ['Database not initialized'] };
  }

  const errors: string[] = [];
  let expired = 0;

  try {
    const snapshot = await rtdb.ref('compOffCredits').once('value');
    const credits = snapshot.val() as Record<string, CompOffCredit> || {};
    const now = new Date();

    for (const [id, credit] of Object.entries(credits)) {
      if (credit.status === 'active' && new Date(credit.expiryDate) < now) {
        try {
          await rtdb.ref(`compOffCredits/${id}`).update({
            status: 'expired',
            expiredAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
          expired++;
        } catch (error) {
          errors.push(`Failed to expire credit ${id}: ${error}`);
        }
      }
    }

    console.log(`✅ Expired ${expired} comp-off credits`);
  } catch (error) {
    console.error('Error expiring comp-off credits:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { expired, errors };
}

/**
 * Create a comp-off credit (for staff request or auto-creation)
 */
export async function createCompOffCredit(data: {
  userId: string;
  userName?: string;
  creditedDays: number;
  reason: string;
  earnedDate: string;
  expiryDate: string;
  status: 'active' | 'pending_approval';
  hoursWorked?: number;
  attachmentUrl?: string | null;
  requestedBy?: string;
  requestedByName?: string;
}): Promise<{ success: boolean; creditId?: string; error?: string }> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: 'Database not initialized' };
  }

  try {
    const creditId = `co_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const credit: CompOffCredit = {
      id: creditId,
      userId: data.userId,
      creditedDays: data.creditedDays,
      usedDays: 0,
      earnedDate: data.earnedDate,
      reason: data.reason,
      expiryDate: data.expiryDate,
      status: data.status,
      approvedBy: null,
      approvedByName: null,
      approvalRemark: null,
      hoursWorked: data.hoursWorked,
      attachmentUrl: data.attachmentUrl || null,
      requestedAt: data.status === 'pending_approval' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    await rtdb.ref(`compOffCredits/${creditId}`).set(credit);

    return { success: true, creditId };
  } catch (error) {
    console.error('Error creating comp-off credit:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Approve a comp-off credit (HOD or Principal)
 */
export async function approveCompOffCredit(
  creditId: string,
  approverId: string,
  approverName: string,
  remark?: string
): Promise<{ success: boolean; error?: string }> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: 'Database not initialized' };
  }

  try {
    const creditRef = rtdb.ref(`compOffCredits/${creditId}`);
    const snapshot = await creditRef.once('value');
    const credit = snapshot.val() as CompOffCredit | null;

    if (!credit) {
      return { success: false, error: 'Credit not found' };
    }

    if (credit.status !== 'pending_approval') {
      return { success: false, error: `Credit is not pending approval (status: ${credit.status})` };
    }

    await creditRef.update({
      status: 'active',
      approvedBy: approverId,
      approvedByName: approverName,
      approvalRemark: remark || null,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error approving comp-off credit:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Reject a comp-off credit (HOD or Principal)
 */
export async function rejectCompOffCredit(
  creditId: string,
  approverId: string,
  approverName: string,
  remark: string
): Promise<{ success: boolean; error?: string }> {
  const rtdb = getRTDB();
  if (!rtdb) {
    return { success: false, error: 'Database not initialized' };
  }

  try {
    const creditRef = rtdb.ref(`compOffCredits/${creditId}`);
    const snapshot = await creditRef.once('value');
    const credit = snapshot.val() as CompOffCredit | null;

    if (!credit) {
      return { success: false, error: 'Credit not found' };
    }

    if (credit.status !== 'pending_approval') {
      return { success: false, error: `Credit is not pending approval (status: ${credit.status})` };
    }

    if (!remark || remark.trim() === '') {
      return { success: false, error: 'Rejection remark is required' };
    }

    await creditRef.update({
      status: 'rejected',
      approvedBy: approverId,
      approvedByName: approverName,
      approvalRemark: remark,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error rejecting comp-off credit:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}