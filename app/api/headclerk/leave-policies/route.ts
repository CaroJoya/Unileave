// app/api/headclerk/leave-policies/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import type { Database } from "firebase-admin/database";

// ============ TYPES ============
interface Policy {
  id: string;
  academicYear: string;
  leaveAllocations: Record<string, Record<string, number>>;
  effectiveFrom: string;
  applyRule: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  collegeId: string;
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId: string;
  collegeName: string;
  status?: string;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface LeaveBalancesDoc {
  userId: string;
  academicYear: string;
  balances: Record<string, LeaveBalance>;
  updatedAt: string;
}

// ============ GET METHOD ============
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);

    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;

    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const policiesSnapshot = await rtdb.ref("leavePolicies").once("value");
    const policies = policiesSnapshot.val() as Record<string, Policy> | null || {};

    const policiesList = Object.entries(policies)
      .filter(([, data]) => data.collegeId === collegeId)
      .map(([id, data]) => ({
        id,
        academicYear: data.academicYear,
        leaveAllocations: data.leaveAllocations,
        effectiveFrom: data.effectiveFrom,
        applyRule: data.applyRule,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isArchived: data.isArchived,
        collegeId: data.collegeId,
      }));

    return NextResponse.json({ policies: policiesList });
  } catch (error) {
    console.error("Error fetching leave policies:", error);
    return NextResponse.json({ error: "Failed to fetch leave policies" }, { status: 500 });
  }
}

// ============ POST METHOD ============
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);

    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;

    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { academicYear, leaveAllocations, applyRule } = body;

    if (!academicYear || !leaveAllocations) {
      return NextResponse.json({ error: "Academic year and leave allocations are required" }, { status: 400 });
    }

    const existingPolicySnapshot = await rtdb.ref(`leavePolicies/${academicYear}`).once("value");
    const existingPolicy = existingPolicySnapshot.val() as Policy | null;

    if (existingPolicy) {
      if (existingPolicy.collegeId === collegeId) {
        return NextResponse.json({ 
          error: `A leave policy for academic year ${academicYear} already exists in your college. Use PUT to update it.`,
          existing: true,
        }, { status: 409 });
      }
      console.log(`📝 Policy ${academicYear} exists in another college, creating for college ${collegeId}`);
    }

    const requiredRoles = ["faculty", "lab_assistant", "office_staff", "hod", "registrar", "principal", "head_clerk"];
    for (const role of requiredRoles) {
      if (!leaveAllocations[role]) {
        return NextResponse.json({ error: `Missing allocations for role: ${role}` }, { status: 400 });
      }
      
      const requiredTypes = ["CL", "EL", "ML", "CO"];
      for (const type of requiredTypes) {
        if (typeof leaveAllocations[role][type] !== "number") {
          return NextResponse.json({ error: `Missing or invalid ${type} quota for ${role}` }, { status: 400 });
        }
      }
    }

    const policyData = {
      id: academicYear,
      academicYear,
      leaveAllocations,
      applyRule: applyRule || "immediate",
      effectiveFrom: applyRule === "immediate" ? new Date().toISOString() : `${parseInt(academicYear.split("-")[0])}-06-01T00:00:00Z`,
      collegeId: collegeId,
      createdBy: decodedToken.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
    };

    await rtdb.ref(`leavePolicies/${academicYear}`).set(policyData);

    // ✅ Immediately apply balances if applyRule is immediate
    if (applyRule === "immediate") {
      console.log(`✅ Policy ${academicYear} applied immediately for college ${collegeId}`);
      const result = await recalculateAllUserBalances(rtdb, collegeId, academicYear, leaveAllocations);
      console.log(`📊 Balance update result: ${result.updated} users updated, ${result.errors.length} errors`);
    }

    return NextResponse.json({ success: true, policy: policyData });
  } catch (error) {
    console.error("Error creating leave policy:", error);
    return NextResponse.json({ error: "Failed to create leave policy" }, { status: 500 });
  }
}

// ============ CORE BALANCE RECALCULATION FUNCTION ============
async function recalculateAllUserBalances(
  rtdb: Database,
  collegeId: string,
  academicYear: string,
  newAllocations: Record<string, Record<string, number>>
): Promise<{ updated: number; errors: string[]; details: string[] }> {
  const errors: string[] = [];
  const details: string[] = [];
  let updated = 0;

  try {
    // 1. Get all active users in the college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, UserRecord> | null || {};
    
    // ✅ CRITICAL FIX: Filter by collegeId AND active status
    const collegeUsers = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId && user.status === "active")
      .map(([uid, user]) => ({ ...user, uid }));

    if (collegeUsers.length === 0) {
      details.push(`ℹ️ No active users found in college ${collegeId}`);
      return { updated: 0, errors: [], details };
    }

    details.push(`📊 Processing ${collegeUsers.length} users in college ${collegeId} for year ${academicYear}`);

    // 2. Process each user
    for (const user of collegeUsers) {
      try {
        const userRole = user.roles?.[0] || "faculty";
        const roleAllocation = newAllocations[userRole] || newAllocations.faculty || {};

        const balanceKey = `${user.uid}_${academicYear}`;
        const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
        const balanceSnapshot = await balanceRef.once("value");
        const existingBalance = balanceSnapshot.val() as LeaveBalancesDoc | null;

        const newBalances: Record<string, LeaveBalance> = {};
        let hasChanges = false;

        if (existingBalance) {
          // ✅ UPDATE EXISTING BALANCE
          // Process all leave types in the new policy
          for (const [leaveType, newAllocated] of Object.entries(roleAllocation)) {
            const oldBalance = existingBalance.balances[leaveType];
            
            if (oldBalance) {
              // Preserve used and pending days
              const used = oldBalance.used || 0;
              const pending = oldBalance.pending || 0;
              const newAvailable = Math.max(0, newAllocated - used - pending);
              
              // Check if anything changed
              if (oldBalance.allocated !== newAllocated || oldBalance.available !== newAvailable) {
                newBalances[leaveType] = {
                  allocated: newAllocated,
                  used: used,
                  pending: pending,
                  available: newAvailable,
                };
                hasChanges = true;
              } else {
                newBalances[leaveType] = { ...oldBalance };
              }
            } else {
              // New leave type added
              details.push(`➕ ${user.name}: Added ${leaveType} with ${newAllocated} days`);
              newBalances[leaveType] = {
                allocated: newAllocated,
                used: 0,
                pending: 0,
                available: newAllocated,
              };
              hasChanges = true;
            }
          }

          // Handle leave types removed from policy
          for (const [oldLeaveType, oldBalance] of Object.entries(existingBalance.balances)) {
            if (!roleAllocation[oldLeaveType] && oldBalance.allocated > 0) {
              details.push(`➖ ${user.name}: Removed ${oldLeaveType}`);
              newBalances[oldLeaveType] = {
                allocated: 0,
                used: 0,
                pending: 0,
                available: 0,
              };
              hasChanges = true;
            }
          }

          if (hasChanges) {
            await balanceRef.update({
              balances: newBalances,
              updatedAt: new Date().toISOString(),
            });
            updated++;
            details.push(`✅ ${user.name}: Balance updated (${Object.keys(newBalances).length} leave types)`);
          } else {
            details.push(`⏭️ ${user.name}: No changes needed`);
          }
        } else {
          // ✅ CREATE NEW BALANCE
          details.push(`🆕 ${user.name}: Creating new balance`);
          
          for (const [leaveType, quota] of Object.entries(roleAllocation)) {
            newBalances[leaveType] = {
              allocated: quota,
              used: 0,
              pending: 0,
              available: quota,
            };
          }

          const newBalanceDoc: LeaveBalancesDoc = {
            userId: user.uid,
            academicYear: academicYear,
            balances: newBalances,
            updatedAt: new Date().toISOString(),
          };

          await balanceRef.set(newBalanceDoc);
          updated++;
          details.push(`✅ ${user.name}: New balance created (${Object.keys(newBalances).length} leave types)`);
        }
      } catch (userError) {
        const errorMsg = `❌ Error processing user ${user.name} (${user.uid}): ${userError}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        details.push(errorMsg);
      }
    }

    details.push(`📊 Balance update completed. Updated: ${updated}, Errors: ${errors.length}`);
    
  } catch (error) {
    const errorMsg = `❌ Failed to update user balances: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
    details.push(errorMsg);
  }

  return { updated, errors, details };
}

// ============ PUT METHOD WITH FULL RECALCULATION ============
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserRecord | null;
    
    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { academicYear, leaveAllocations, applyRule } = body;

    if (!academicYear || !leaveAllocations) {
      return NextResponse.json({ error: "Academic year and leave allocations are required" }, { status: 400 });
    }

    // 1. Get existing policy
    const existingSnapshot = await rtdb.ref(`leavePolicies/${academicYear}`).once("value");
    const existing = existingSnapshot.val() as Policy | null;

    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    if (existing.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "You are not authorized to modify policies from other colleges" 
      }, { status: 403 });
    }

    // 2. Validate allocations
    const requiredRoles = ["faculty", "lab_assistant", "office_staff", "hod", "registrar", "principal", "head_clerk"];
    for (const role of requiredRoles) {
      if (!leaveAllocations[role]) {
        return NextResponse.json({ error: `Missing allocations for role: ${role}` }, { status: 400 });
      }
      
      const requiredTypes = ["CL", "EL", "ML", "CO"];
      for (const type of requiredTypes) {
        if (typeof leaveAllocations[role][type] !== "number") {
          return NextResponse.json({ error: `Missing or invalid ${type} quota for ${role}` }, { status: 400 });
        }
      }
    }

    // 3. Update the policy
    const updatedPolicy = {
      ...existing,
      leaveAllocations,
      applyRule: applyRule || existing.applyRule,
      updatedAt: new Date().toISOString(),
    };

    await rtdb.ref(`leavePolicies/${academicYear}`).set(updatedPolicy);

    // 4. ✅ CRITICAL: Recalculate ALL user balances - THIS IS THE FIX
    console.log(`🔄 Policy updated. Recalculating balances for college ${collegeId}, year ${academicYear}`);
    
    const { updated, errors, details } = await recalculateAllUserBalances(
      rtdb,
      collegeId,
      academicYear,
      leaveAllocations
    );

    // 5. Log the action with detailed results
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: decodedToken.uid,
      userName: userData.name || "Head Clerk",
      userRole: "head_clerk",
      action: "POLICY_UPDATED",
      module: "leavePolicies",
      targetId: academicYear,
      details: JSON.stringify({
        academicYear,
        collegeId,
        changes: {
          oldAllocations: existing.leaveAllocations,
          newAllocations: leaveAllocations,
        },
        balanceRecalculation: {
          usersUpdated: updated,
          errors: errors,
          details: details,
        },
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date().toISOString(),
    });

    // 6. Return comprehensive response with balance update results
    return NextResponse.json({
      success: true,
      policy: updatedPolicy,
      balanceUpdate: {
        usersUpdated: updated,
        errors: errors,
        details: details,
        message: errors.length === 0 
          ? `✅ Policy updated and ${updated} user balance(s) updated successfully.` 
          : `⚠️ Policy updated but ${errors.length} error(s) occurred during balance update.`,
      }
    });
  } catch (error) {
    console.error("Error updating leave policy:", error);
    return NextResponse.json({ error: "Failed to update leave policy" }, { status: 500 });
  }
}