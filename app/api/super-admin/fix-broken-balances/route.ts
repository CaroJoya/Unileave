// app/api/super-admin/fix-broken-balances/route.ts - COMPLETE FIXED VERSION
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";
import { createAuditLog } from "@/lib/services/audit-service";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  totalDays: number;
  status: string;
  balanceRestored?: boolean;
  cancelledAt?: string;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface LeaveBalanceDoc {
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
  collegeId?: string;
  [key: string]: unknown;
}

interface FixedRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  totalDays: number;
  msg: string;
}

interface FailedRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  totalDays: number;
  error: string;
}

const DEFAULT_QUOTAS: Record<string, Record<string, number>> = {
  faculty: { CL: 24, EL: 12, ML: 15, CO: 10 },
  lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8 },
  office_staff: { CL: 20, EL: 10, ML: 15, CO: 8 },
  hod: { CL: 24, EL: 15, ML: 15, CO: 10 },
  registrar: { CL: 20, EL: 12, ML: 15, CO: 10 },
  principal: { CL: 30, EL: 20, ML: 15, CO: 12 },
  head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10 },
};

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
    
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as UserData | null;
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized - Super Admin only" }, { status: 403 });
    }

    const adminCollegeId = adminData.collegeId;
    
    let body: { action?: string };
    try {
      body = await request.json();
    } catch {
      body = { action: "find" };
    }
    
    const { action } = body;
    console.log(`🔧 FixBrokenBalances: Action = ${action}, College = ${adminCollegeId}`);

    const requestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = requestsSnapshot.val() as Record<string, LeaveRequest> | null || {};

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, UserData> | null || {};

    const collegeUserIds = Object.entries(users)
      .filter(([, user]) => user.collegeId === adminCollegeId)
      .map(([uid]) => uid);

    const brokenRequests: LeaveRequest[] = [];

    for (const [id, req] of Object.entries(allRequests)) {
      if (req.status === "Cancelled" && req.balanceRestored !== true) {
        if (collegeUserIds.includes(req.applicantId)) {
          brokenRequests.push({
            ...req,
            id,
          });
        } else {
          console.log(`⏭️ Skipping request ${id} - user not in college`);
        }
      }
    }

    console.log(`🔍 Found ${brokenRequests.length} broken requests`);

    if (action === "find") {
      const academicYear = getCurrentAcademicYear();
      const requestsWithDetails = [];

      for (const req of brokenRequests) {
        const balanceKey = `${req.applicantId}_${academicYear}`;
        const balanceSnapshot = await rtdb.ref(`leaveBalances/${balanceKey}`).once("value");
        const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

        requestsWithDetails.push({
          ...req,
          hasBalanceDoc: !!balanceDoc,
          hasLeaveType: balanceDoc?.balances?.[req.leaveType] ? true : false,
        });
      }

      return NextResponse.json({
        success: true,
        brokenRequests: requestsWithDetails,
        count: requestsWithDetails.length,
        academicYear,
      });
    }

    const academicYear = getCurrentAcademicYear();
    let fixed = 0;
    let failed = 0;
    const details: string[] = [];
    const fixedRequests: FixedRequest[] = [];
    const failedRequests: FailedRequest[] = [];

    for (const req of brokenRequests) {
      try {
        console.log(`📝 Processing request ${req.id} for user ${req.applicantId}`);
        console.log(`   Leave Type: ${req.leaveType}, Days: ${req.totalDays}`);

        const balanceKey = `${req.applicantId}_${academicYear}`;
        const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
        const balanceSnapshot = await balanceRef.once("value");
        const existingBalanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

        if (!existingBalanceDoc) {
          console.log(`⚠️ Balance not found for user ${req.applicantId}, creating...`);
          
          const userData = users[req.applicantId];
          const userRole = userData?.roles?.[0] || "faculty";
          
          const quotas = DEFAULT_QUOTAS[userRole] || DEFAULT_QUOTAS.faculty;
          const newBalances: Record<string, LeaveBalance> = {};
          
          for (const [type, quota] of Object.entries(quotas)) {
            newBalances[type] = {
              allocated: quota,
              used: 0,
              pending: 0,
              available: quota,
            };
          }
          
          if (!newBalances[req.leaveType]) {
            newBalances[req.leaveType] = {
              allocated: 0,
              used: 0,
              pending: 0,
              available: 0,
            };
          }
          
          newBalances[req.leaveType].available += req.totalDays;
          
          const newBalanceDoc: LeaveBalanceDoc = {
            userId: req.applicantId,
            academicYear,
            balances: newBalances,
            updatedAt: new Date().toISOString(),
          };
          
          await balanceRef.set(newBalanceDoc);
          console.log(`✅ Balance CREATED for user ${req.applicantId}`);
          
          const msg = `✅ ${req.applicantName || req.applicantId} - ${req.leaveType}: Balance created and ${req.totalDays} day(s) restored`;
          details.push(msg);
          fixedRequests.push({ 
            id: req.id,
            applicantId: req.applicantId,
            applicantName: req.applicantName || req.applicantId,
            leaveType: req.leaveType,
            totalDays: req.totalDays,
            msg 
          });
          fixed++;
        } else {
          const balanceDoc = existingBalanceDoc;
          
          if (!balanceDoc.balances) {
            balanceDoc.balances = {};
          }
          
          if (!balanceDoc.balances[req.leaveType]) {
            balanceDoc.balances[req.leaveType] = {
              allocated: 0,
              used: 0,
              pending: 0,
              available: 0,
            };
          }
          
          const currentBalance = balanceDoc.balances[req.leaveType];
          
          const newPending = Math.max(0, (currentBalance.pending || 0) - req.totalDays);
          const newAvailable = (currentBalance.available || 0) + req.totalDays;
          
          console.log(`   Current: pending=${currentBalance.pending}, available=${currentBalance.available}`);
          console.log(`   New: pending=${newPending}, available=${newAvailable}`);
          
          await balanceRef.update({
            [`balances.${req.leaveType}.pending`]: newPending,
            [`balances.${req.leaveType}.available`]: newAvailable,
            updatedAt: new Date().toISOString(),
          });
          
          console.log(`✅ Balance UPDATED for user ${req.applicantId}`);
          
          const msg = `✅ ${req.applicantName || req.applicantId} - ${req.leaveType}: ${req.totalDays} day(s) restored`;
          details.push(msg);
          fixedRequests.push({ 
            id: req.id,
            applicantId: req.applicantId,
            applicantName: req.applicantName || req.applicantId,
            leaveType: req.leaveType,
            totalDays: req.totalDays,
            msg 
          });
          fixed++;
        }

        await rtdb.ref(`leaveRequests/${req.id}`).update({
          balanceRestored: true,
          balanceRestoredAt: new Date().toISOString(),
          balanceRestoredBy: decodedToken.uid,
        });
        
        console.log(`✅ Request ${req.id} marked as restored`);

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`❌ Error fixing request ${req.id}:`, errorMsg);
        
        const msg = `❌ ${req.applicantName || req.applicantId} - ${req.leaveType}: Failed - ${errorMsg}`;
        details.push(msg);
        failedRequests.push({ 
          id: req.id,
          applicantId: req.applicantId,
          applicantName: req.applicantName || req.applicantId,
          leaveType: req.leaveType,
          totalDays: req.totalDays,
          error: errorMsg 
        });
      }
    }

    await createAuditLog({
      userId: decodedToken.uid,
      userName: adminData.name || "Super Admin",
      userRole: "super_admin",
      action: "ASSIGNMENTS_VALIDATED",
      module: "leaveRequests",
      details: {
        action: "BROKEN_BALANCES_FIXED",
        fixed,
        failed,
        details,
        academicYear,
        collegeId: adminCollegeId,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      fixed,
      failed,
      totalFound: brokenRequests.length,
      fixedRequests,
      failedRequests,
      details,
      message: `Fixed ${fixed} request(s), failed ${failed} request(s)`,
    });

  } catch (error) {
    console.error("Error fixing broken balances:", error);
    return NextResponse.json(
      { error: "Failed to fix broken balances" },
      { status: 500 }
    );
  }
}