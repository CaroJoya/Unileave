// app/api/headclerk/year-reset/route.ts - COMPLETE FIXED FILE WITH COLLEGE ISOLATION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";

interface LeavePolicy {
  id: string;
  academicYear: string;
  leaveAllocations: Record<string, Record<string, number>>;
  effectiveFrom: string;
  applyRule: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  collegeId: string; // ✅ Add collegeId
}

interface CarryOverRule {
  leaveType: string;
  carryOver: boolean;
  maxCarryOver: number | null;
}

interface YearResetRequest {
  action: "continue" | "modify";
  newAcademicYear: string;
  leaveAllocations?: Record<string, Record<string, number>>;
  carryOverRules: CarryOverRule[];
  confirmation: boolean;
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

interface UserData {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  subRole?: string;
  isEmployed: boolean;
  status: string;
  collegeId: string; // ✅ Add collegeId
  collegeName: string;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  details: string;
  createdAt: string;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata: string | null;
  createdAt: string;
}

function generateYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const options = [];
  for (let i = -1; i <= 2; i++) {
    const year = currentYear + i;
    options.push(`${year}-${year + 1}`);
  }
  return options;
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
    const userData = userSnapshot.val() as { roles?: string[]; name?: string; collegeId?: string } | null;

    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    // ✅ Get the Head Clerk's college ID
    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const currentYear = getCurrentAcademicYear();

    // ✅ Filter policies by college
    const policiesSnapshot = await rtdb.ref("leavePolicies").once("value");
    const policies = policiesSnapshot.val() as Record<string, LeavePolicy> | null || {};

    const collegePolicies = Object.values(policies)
      .filter((policy) => {
        if (policy.collegeId) {
          return policy.collegeId === collegeId;
        }
        return policy.collegeId === undefined || policy.collegeId === collegeId;
      })
      .map((policy) => ({
        academicYear: policy.academicYear,
        leaveAllocations: policy.leaveAllocations,
        effectiveFrom: policy.effectiveFrom,
        applyRule: policy.applyRule,
        createdBy: policy.createdBy,
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
        isArchived: policy.isArchived || false,
      }));

    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const leaveTypes = leaveTypesSnapshot.val() as Record<string, { leaveCode: string; isActive: boolean; collegeId?: string }> | null || {};

    // ✅ Filter leave types by college
    const leaveTypeCodes = Object.values(leaveTypes)
      .filter((type) => {
        if (type.collegeId) {
          return type.collegeId === collegeId;
        }
        return type.collegeId === undefined || type.collegeId === collegeId;
      })
      .filter((type) => type.isActive !== false)
      .map((type) => type.leaveCode);

    const resetLogsSnapshot = await rtdb.ref("auditLogs").once("value");
    const allLogs = resetLogsSnapshot.val() as Record<string, AuditLog> | null || {};

    const yearResets = Object.values(allLogs).filter(
      (log) => log.action === "YEAR_RESET_EXECUTED" && log.details?.includes(collegeId)
    );

    const lastReset = yearResets.length > 0 ? yearResets[yearResets.length - 1] : null;

    return NextResponse.json({
      currentAcademicYear: currentYear,
      availableYears: generateYearOptions(),
      leaveTypes: leaveTypeCodes,
      policies: collegePolicies,
      lastReset: lastReset,
      hasReset: yearResets.length > 0,
      collegeId: collegeId,
    });
  } catch (error) {
    console.error("Error fetching year reset data:", error);
    return NextResponse.json({ error: "Failed to fetch year reset data" }, { status: 500 });
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
    const userData = userSnapshot.val() as { roles?: string[]; name?: string; collegeId?: string; collegeName?: string } | null;

    if (!userData?.roles?.includes("head_clerk")) {
      return NextResponse.json({ error: "Not authorized - Head Clerk only" }, { status: 403 });
    }

    // ✅ Get the Head Clerk's college ID
    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "Head Clerk has no college assigned" }, { status: 400 });
    }

    const body = (await request.json()) as YearResetRequest;

    if (!body.confirmation) {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
    }

    if (!body.newAcademicYear) {
      return NextResponse.json({ error: "New academic year is required" }, { status: 400 });
    }

    // ✅ Check if policy exists for this college
    const existingPolicySnapshot = await rtdb
      .ref(`leavePolicies/${body.newAcademicYear}`)
      .once("value");
    const existingPolicy = existingPolicySnapshot.val() as LeavePolicy | null;

    if (existingPolicy) {
      // ✅ Verify policy belongs to this college
      if (existingPolicy.collegeId && existingPolicy.collegeId !== collegeId) {
        return NextResponse.json({ 
          error: `A policy for ${body.newAcademicYear} exists in another college. You cannot access it.` 
        }, { status: 403 });
      }
      return NextResponse.json(
        {
          error: `Policy for ${body.newAcademicYear} already exists in your college. Please choose a different year.`,
        },
        { status: 409 }
      );
    }

    const currentAcademicYear = getCurrentAcademicYear();
    const currentPolicySnapshot = await rtdb
      .ref(`leavePolicies/${currentAcademicYear}`)
      .once("value");
    const currentPolicy = currentPolicySnapshot.val() as LeavePolicy | null;

    if (!currentPolicy) {
      return NextResponse.json({ error: "Current policy not found" }, { status: 404 });
    }

    // ✅ Verify current policy belongs to this college
    if (currentPolicy.collegeId && currentPolicy.collegeId !== collegeId) {
      return NextResponse.json({ 
        error: "Current policy belongs to another college. Cannot reset." 
      }, { status: 403 });
    }

    let newPolicy: LeavePolicy;

    if (body.action === "continue") {
      newPolicy = {
        id: body.newAcademicYear,
        academicYear: body.newAcademicYear,
        leaveAllocations: { ...currentPolicy.leaveAllocations },
        effectiveFrom: new Date().toISOString(),
        applyRule: currentPolicy.applyRule || "immediate",
        createdBy: decodedToken.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        collegeId: collegeId, // ✅ Store college ID
      };
    } else {
      if (!body.leaveAllocations) {
        return NextResponse.json(
          { error: "Leave allocations required for modify action" },
          { status: 400 }
        );
      }
      newPolicy = {
        id: body.newAcademicYear,
        academicYear: body.newAcademicYear,
        leaveAllocations: body.leaveAllocations,
        effectiveFrom: new Date().toISOString(),
        applyRule: "immediate",
        createdBy: decodedToken.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isArchived: false,
        collegeId: collegeId, // ✅ Store college ID
      };
    }

    await rtdb.ref(`leavePolicies/${body.newAcademicYear}`).set(newPolicy);

    // ✅ Get only users from the SAME college
    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, UserData> | null || {};

    const activeUsers = Object.entries(allUsers)
      .filter(([, user]) => 
        user.isEmployed !== false && 
        user.status === "active" &&
        user.collegeId === collegeId // ✅ Critical college filter
      )
      .map(([uid, user]) => ({ ...user, uid }));

    const balanceUpdates: Record<string, LeaveBalancesDoc> = {};
    const carryOverLogs: Record<string, { carryOverApplied: string[] }> = {};

    for (const user of activeUsers) {
      const roleKey = user.subRole || user.roles?.[0] || "faculty";
      const allocation = newPolicy.leaveAllocations[roleKey] || newPolicy.leaveAllocations.faculty || {};

      const prevBalanceKey = `${user.uid}_${currentAcademicYear}`;
      const prevBalanceSnapshot = await rtdb
        .ref(`leaveBalances/${prevBalanceKey}`)
        .once("value");
      const prevBalance = prevBalanceSnapshot.val() as LeaveBalancesDoc | null;

      const newBalances: Record<string, LeaveBalance> = {};
      const carryOverApplied: string[] = [];

      for (const rule of body.carryOverRules) {
        const prev = prevBalance?.balances?.[rule.leaveType];
        const allocated = (allocation as Record<string, number>)?.[rule.leaveType] || 0;

        let available = allocated;
        let carryOverAmount = 0;

        if (rule.carryOver && prev) {
          const unused = prev.available || 0;
          if (unused > 0) {
            if (rule.maxCarryOver !== null) {
              carryOverAmount = Math.min(unused, rule.maxCarryOver);
            } else {
              carryOverAmount = unused;
            }
            available = allocated + carryOverAmount;
            carryOverApplied.push(rule.leaveType);
          }
        }

        newBalances[rule.leaveType] = {
          allocated: allocated,
          used: 0,
          pending: 0,
          available: available,
        };
      }

      const balanceDoc: LeaveBalancesDoc = {
        userId: user.uid,
        academicYear: body.newAcademicYear,
        balances: newBalances,
        updatedAt: new Date().toISOString(),
      };

      balanceUpdates[`${user.uid}_${body.newAcademicYear}`] = balanceDoc;

      if (carryOverApplied.length > 0) {
        carryOverLogs[user.uid] = {
          carryOverApplied,
        };
      }
    }

    // Batch update balances
    const balanceRef = rtdb.ref("leaveBalances");
    const batchUpdates: Record<string, LeaveBalancesDoc> = {};
    for (const [key, value] of Object.entries(balanceUpdates)) {
      batchUpdates[key] = value;
    }
    await balanceRef.update(batchUpdates);

    // ✅ Archive with college ID
    await rtdb.ref(`archivedPolicies/${currentAcademicYear}`).set({
      policy: currentPolicy,
      archivedAt: new Date().toISOString(),
      archivedBy: decodedToken.uid,
      newYear: body.newAcademicYear,
      collegeId: collegeId,
    });

    await rtdb.ref(`leavePolicies/${currentAcademicYear}`).update({
      isArchived: true,
      archivedAt: new Date().toISOString(),
    });

    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: decodedToken.uid,
      userName: userData.name || "Head Clerk",
      userRole: "head_clerk",
      action: "YEAR_RESET_EXECUTED",
      module: "leavePolicies",
      details: JSON.stringify({
        newAcademicYear: body.newAcademicYear,
        previousAcademicYear: currentAcademicYear,
        action: body.action,
        carryOverRules: body.carryOverRules,
        usersAffected: activeUsers.length,
        collegeId: collegeId,
      }),
      createdAt: new Date().toISOString(),
    });

    // ✅ Send notifications only to users in this college
    const notifications: Record<string, Notification> = {};
    const baseNotificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    for (const user of activeUsers) {
      const notifId = `${baseNotificationId}_${user.uid}`;
      const carryOverInfo = carryOverLogs[user.uid];

      let message = `The academic year has been reset to ${body.newAcademicYear}. Your leave balances have been updated.`;
      if (carryOverInfo?.carryOverApplied && carryOverInfo.carryOverApplied.length > 0) {
        message += ` Unused leave from ${carryOverInfo.carryOverApplied.join(", ")} has been carried over.`;
      }

      notifications[notifId] = {
        id: notifId,
        userId: user.uid,
        title: "Academic Year Reset",
        message: message,
        type: "year_reset",
        isRead: false,
        metadata: JSON.stringify({
          newAcademicYear: body.newAcademicYear,
          previousAcademicYear: currentAcademicYear,
          carryOverApplied: carryOverInfo?.carryOverApplied || [],
          collegeId: collegeId,
        }),
        createdAt: new Date().toISOString(),
      };
    }

    await rtdb.ref("notifications").update(notifications);

    return NextResponse.json({
      success: true,
      message: `Year reset to ${body.newAcademicYear} completed successfully for college ${collegeId}`,
      usersAffected: activeUsers.length,
      newPolicy: newPolicy,
    });
  } catch (error) {
    console.error("Error executing year reset:", error);
    return NextResponse.json({ error: "Failed to execute year reset" }, { status: 500 });
  }
}