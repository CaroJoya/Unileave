// app/api/headclerk/leave-policies/route.ts - COMPLETE FIXED FILE WITH POLICY UPDATE RECALCULATION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";

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

    // ✅ Filter policies by college
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

    // ✅ Check if policy exists for THIS college
    const existingPolicySnapshot = await rtdb.ref(`leavePolicies/${academicYear}`).once("value");
    const existingPolicy = existingPolicySnapshot.val() as Policy | null;

    if (existingPolicy) {
      // ✅ If policy exists in THIS college, block creation
      if (existingPolicy.collegeId === collegeId) {
        return NextResponse.json({ 
          error: `A leave policy for academic year ${academicYear} already exists in your college. Use PUT to update it.`,
          existing: true,
        }, { status: 409 });
      }
      // ✅ If policy exists in ANOTHER college, we can create a new one for this college
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
      collegeId: collegeId, // ✅ Store college ID
      createdBy: decodedToken.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
    };

    await rtdb.ref(`leavePolicies/${academicYear}`).set(policyData);

    if (applyRule === "immediate") {
      console.log(`✅ Policy ${academicYear} applied immediately for college ${collegeId}`);
    }

    return NextResponse.json({ success: true, policy: policyData });
  } catch (error) {
    console.error("Error creating leave policy:", error);
    return NextResponse.json({ error: "Failed to create leave policy" }, { status: 500 });
  }
}

// ========== HELPER FUNCTION TO UPDATE USER BALANCES ==========
async function updateUserBalancesForPolicy(
  rtdb: any,
  collegeId: string,
  academicYear: string,
  leaveAllocations: Record<string, Record<string, number>>
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  try {
    // 1. Get all active users in the same college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, UserRecord> | null || {};
    
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId && user.status === "active")
      .map(([uid]) => uid);

    if (collegeUserIds.length === 0) {
      console.log(`ℹ️ No active users found in college ${collegeId} to update balances.`);
      return { updated: 0, errors: [] };
    }

    console.log(`📊 Updating balances for ${collegeUserIds.length} users in college ${collegeId} for year ${academicYear}`);

    // 2. Process each user
    for (const userId of collegeUserIds) {
      try {
        const user = allUsers[userId];
        const userRole = user.roles?.[0] || "faculty";
        const roleAllocation = leaveAllocations[userRole] || leaveAllocations.faculty || {};

        const balanceKey = `${userId}_${academicYear}`;
        const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
        const balanceSnapshot = await balanceRef.once("value");
        const existingBalance = balanceSnapshot.val() as LeaveBalancesDoc | null;

        if (existingBalance) {
          // ✅ POLICY UPDATE: Update existing balance
          console.log(`🔄 Updating balance for user ${userId} (${user.name})`);
          
          const newBalances: Record<string, LeaveBalance> = {};
          let hasChanges = false;

          // Process all leave types in the new policy
          for (const [leaveType, newAllocated] of Object.entries(roleAllocation)) {
            const oldBalance = existingBalance.balances[leaveType];
            
            if (oldBalance) {
              // ✅ Update: Preserve used/pending, update allocated and recalculate available
              const used = oldBalance.used || 0;
              const pending = oldBalance.pending || 0;
              
              // The new available is (new allocated - used - pending)
              const newAvailable = Math.max(0, newAllocated - used - pending);
              
              // Only update if there's a change
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
              // ✅ NEW leave type added to policy
              console.log(`➕ Adding new leave type ${leaveType} for user ${userId}`);
              newBalances[leaveType] = {
                allocated: newAllocated,
                used: 0,
                pending: 0,
                available: newAllocated,
              };
              hasChanges = true;
            }
          }

          // ✅ Handle leave types removed from the policy (remove from balance)
          for (const [oldLeaveType] of Object.entries(existingBalance.balances)) {
            if (!roleAllocation[oldLeaveType]) {
              console.log(`➖ Removing leave type ${oldLeaveType} for user ${userId}`);
              // Mark as removed by setting allocated to 0 and available to 0
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
          }
        } else {
          // ✅ NO EXISTING BALANCE: Create one
          console.log(`🆕 Creating new balance for user ${userId} (${user.name})`);
          
          const newBalances: Record<string, LeaveBalance> = {};
          for (const [leaveType, quota] of Object.entries(roleAllocation)) {
            newBalances[leaveType] = {
              allocated: quota,
              used: 0,
              pending: 0,
              available: quota,
            };
          }

          const newBalanceDoc: LeaveBalancesDoc = {
            userId: userId,
            academicYear: academicYear,
            balances: newBalances,
            updatedAt: new Date().toISOString(),
          };

          await balanceRef.set(newBalanceDoc);
          updated++;
        }
      } catch (userError) {
        const errorMsg = `Error processing user ${userId}: ${userError}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`✅ Balance update completed. Updated: ${updated}, Errors: ${errors.length}`);
  } catch (error) {
    const errorMsg = `Failed to update user balances: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);
  }

  return { updated, errors };
}

// ========== UPDATED PUT METHOD ==========
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

    const existingSnapshot = await rtdb.ref(`leavePolicies/${academicYear}`).once("value");
    const existing = existingSnapshot.val() as Policy | null;

    if (!existing) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    // ✅ CRITICAL FIX: Only allow updating policies from the SAME college
    if (existing.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "You are not authorized to modify policies from other colleges" 
      }, { status: 403 });
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

    const updatedPolicy = {
      ...existing,
      leaveAllocations,
      applyRule: applyRule || existing.applyRule,
      updatedAt: new Date().toISOString(),
    };

    await rtdb.ref(`leavePolicies/${academicYear}`).set(updatedPolicy);

    // ========== ✅ NEW: Recalculate user balances ==========
    console.log(`🔄 Policy updated. Recalculating balances for college ${collegeId}, year ${academicYear}`);
    
    const { updated, errors } = await updateUserBalancesForPolicy(
      rtdb,
      collegeId,
      academicYear,
      leaveAllocations
    );

    if (errors.length > 0) {
      console.warn(`⚠️ Balance update completed with ${errors.length} errors:`, errors);
    }

    // ✅ Log the policy update with balance recalculation info
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
        },
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      policy: updatedPolicy,
      balanceUpdate: {
        usersUpdated: updated,
        errors: errors,
        message: errors.length === 0 
          ? `Policy updated and ${updated} user balance(s) updated successfully.` 
          : `Policy updated but ${errors.length} error(s) occurred during balance update.`,
      }
    });
  } catch (error) {
    console.error("Error updating leave policy:", error);
    return NextResponse.json({ error: "Failed to update leave policy" }, { status: 500 });
  }
}