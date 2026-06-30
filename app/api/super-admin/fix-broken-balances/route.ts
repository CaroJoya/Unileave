// app/api/super-admin/fix-broken-balances/route.ts - COMPLETE FIXED FILE (ESLint Compliant)
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
  balanceRestored: boolean;
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
  [key: string]: unknown;
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

    const body = await request.json();
    const { action } = body; // "find" or "fix"

    // Get all leave requests
    const requestsSnapshot = await rtdb.ref("leaveRequests").once("value");
    const allRequests = requestsSnapshot.val() as Record<string, LeaveRequest> | null || {};

    // Find broken requests: Cancelled but balanceRestored is false
    const brokenRequests: (LeaveRequest & { error?: string })[] = [];

    for (const [id, req] of Object.entries(allRequests)) {
      if (req.status === "Cancelled" && req.balanceRestored === false) {
        brokenRequests.push({ ...req, id });
      }
    }

    // If action is "find", just return the list
    if (action === "find") {
      // Check if each broken request has a valid balance document
      const academicYear = getCurrentAcademicYear();
      const requestsWithErrors = [];

      for (const req of brokenRequests) {
        const balanceKey = `${req.applicantId}_${academicYear}`;
        const balanceSnapshot = await rtdb.ref(`leaveBalances/${balanceKey}`).once("value");
        const balanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

        if (!balanceDoc || !balanceDoc.balances || !balanceDoc.balances[req.leaveType]) {
          requestsWithErrors.push({
            ...req,
            error: "Balance record missing"
          });
        } else {
          requestsWithErrors.push(req);
        }
      }

      return NextResponse.json({
        brokenRequests: requestsWithErrors,
        count: requestsWithErrors.length,
      });
    }

    // If action is "fix", restore the balances and CREATE if missing
    const academicYear = getCurrentAcademicYear();
    let fixed = 0;
    let failed = 0;
    const details: string[] = [];

    for (const req of brokenRequests) {
      try {
        const balanceKey = `${req.applicantId}_${academicYear}`;
        const balanceRef = rtdb.ref(`leaveBalances/${balanceKey}`);
        const balanceSnapshot = await balanceRef.once("value");
        const existingBalanceDoc = balanceSnapshot.val() as LeaveBalanceDoc | null;

        // STEP 1: If balance doesn't exist, CREATE IT!
        if (!existingBalanceDoc) {
          console.log(`⚠️ Balance not found for user ${req.applicantId}, creating...`);
          
          // Get user data to determine role
          const userSnapshot = await rtdb.ref(`users/${req.applicantId}`).once("value");
          const userData = userSnapshot.val() as { roles?: string[]; name?: string } | null;
          const userRole = userData?.roles?.[0] || "faculty";
          
          // Get quotas based on role
          const quotas = DEFAULT_QUOTAS[userRole] || DEFAULT_QUOTAS.faculty;
          const newBalances: Record<string, LeaveBalance> = {};
          
          // Initialize all leave types with quotas
          for (const [type, quota] of Object.entries(quotas)) {
            newBalances[type] = {
              allocated: quota,
              used: 0,
              pending: 0,
              available: quota,
            };
          }
          
          // Make sure the leave type exists (add if missing)
          if (!newBalances[req.leaveType]) {
            newBalances[req.leaveType] = {
              allocated: 0,
              used: 0,
              pending: 0,
              available: 0,
            };
          }
          
          // CRITICAL: Add the restored days to available
          newBalances[req.leaveType].available += req.totalDays;
          
          // Create the balance document
          const newBalanceDoc: LeaveBalanceDoc = {
            userId: req.applicantId,
            academicYear,
            balances: newBalances,
            updatedAt: new Date().toISOString(),
          };
          
          await balanceRef.set(newBalanceDoc);
          console.log(`✅ Balance CREATED for user ${req.applicantId} with ${req.totalDays} days restored`);
          
          details.push(`✅ ${req.applicantName || req.applicantId} - ${req.leaveType}: Balance created and ${req.totalDays} day(s) restored`);
          fixed++;
          
        } else {
          // STEP 2: Balance exists, restore the days
          const balanceDoc = existingBalanceDoc;
          
          if (!balanceDoc.balances) {
            balanceDoc.balances = {};
          }
          
          if (!balanceDoc.balances[req.leaveType]) {
            // Create the leave type entry if it doesn't exist
            balanceDoc.balances[req.leaveType] = {
              allocated: 0,
              used: 0,
              pending: 0,
              available: 0,
            };
          }
          
          const currentBalance = balanceDoc.balances[req.leaveType];
          
          await balanceRef.update({
            [`balances.${req.leaveType}.pending`]: Math.max(0, (currentBalance.pending || 0) - req.totalDays),
            [`balances.${req.leaveType}.available`]: (currentBalance.available || 0) + req.totalDays,
            updatedAt: new Date().toISOString(),
          });
          
          console.log(`✅ Balance RESTORED for user ${req.applicantId}, ${req.leaveType}: ${req.totalDays} days`);
          details.push(`✅ ${req.applicantName || req.applicantId} - ${req.leaveType}: ${req.totalDays} day(s) restored`);
          fixed++;
        }

        // STEP 3: Mark the request as balance restored
        await rtdb.ref(`leaveRequests/${req.id}`).update({
          balanceRestored: true,
          balanceRestoredAt: new Date().toISOString(),
          balanceRestoredBy: decodedToken.uid,
        });
        
        console.log(`✅ Request ${req.id} marked as restored`);

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        details.push(`❌ ${req.applicantName || req.applicantId} - ${req.leaveType}: Failed - ${errorMsg}`);
        console.error(`❌ Error fixing request ${req.id}:`, error);
      }
    }

    // Log the action
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
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      fixed,
      failed,
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