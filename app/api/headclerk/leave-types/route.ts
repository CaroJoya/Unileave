// app/api/headclerk/leave-types/route.ts - COMPLETE FIXED FILE WITH POLICY AUTO-UPDATE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getCurrentAcademicYear } from "@/lib/utils/academicYear";

interface LeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  description: string;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  deductsBalance: boolean;
  hasExpiry: boolean;
  expiryInDays: number | null;
  maxConsecutiveDays: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  collegeId?: string;
}

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

    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const leaveTypes = leaveTypesSnapshot.val() as Record<string, LeaveType> | null || {};

    // Filter leave types by college
    const leaveTypesList = Object.entries(leaveTypes)
      .filter(([, data]) => {
        if (data.collegeId) {
          return data.collegeId === collegeId;
        }
        return data.collegeId === undefined || data.collegeId === null || data.collegeId === collegeId;
      })
      .map(([id, data]) => ({
        id,
        leaveCode: data.leaveCode,
        leaveName: data.leaveName,
        description: data.description,
        allowHalfDay: data.allowHalfDay,
        requiresAttachment: data.requiresAttachment,
        deductsBalance: data.deductsBalance,
        hasExpiry: data.hasExpiry,
        expiryInDays: data.expiryInDays,
        maxConsecutiveDays: data.maxConsecutiveDays,
        isActive: data.isActive,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        collegeId: data.collegeId || collegeId,
      }));

    return NextResponse.json({ leaveTypes: leaveTypesList });
  } catch (error) {
    console.error("Error fetching leave types:", error);
    return NextResponse.json({ error: "Failed to fetch leave types" }, { status: 500 });
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
    const { 
      leaveCode, 
      leaveName, 
      description, 
      allowHalfDay, 
      requiresAttachment, 
      deductsBalance,
      hasExpiry,
      expiryInDays,
      maxConsecutiveDays,
      addToPolicy = false, // ✅ NEW: Optional flag to add to policy
    } = body;

    if (!leaveCode || !leaveName) {
      return NextResponse.json({ error: "Leave code and name are required" }, { status: 400 });
    }

    // ✅ Check for duplicate leave code in the SAME college
    const leaveTypesSnapshot = await rtdb.ref("leaveTypes").once("value");
    const existingTypes = leaveTypesSnapshot.val() as Record<string, LeaveType> | null || {};
    
    for (const [, type] of Object.entries(existingTypes)) {
      if (type.leaveCode === leaveCode.toUpperCase() && type.collegeId === collegeId) {
        return NextResponse.json({ 
          error: `Leave type "${leaveCode.toUpperCase()}" already exists in your college` 
        }, { status: 400 });
      }
    }

    const leaveTypeId = `leave_${leaveCode.toLowerCase()}_${Date.now()}`;
    const leaveTypeData: LeaveType = {
      id: leaveTypeId,
      leaveCode: leaveCode.toUpperCase(),
      leaveName,
      description: description || "",
      allowHalfDay: allowHalfDay || false,
      requiresAttachment: requiresAttachment || false,
      deductsBalance: deductsBalance !== false,
      hasExpiry: hasExpiry || false,
      expiryInDays: expiryInDays || null,
      maxConsecutiveDays: maxConsecutiveDays || null,
      isActive: true,
      collegeId: collegeId,
      createdBy: decodedToken.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await rtdb.ref(`leaveTypes/${leaveTypeId}`).set(leaveTypeData);

    // ✅ NEW: Add to current policy if requested
    let policyUpdated = false;
    let policyMessage = "";
    
    if (addToPolicy) {
      try {
        const currentYear = getCurrentAcademicYear();
        const policyRef = rtdb.ref(`leavePolicies/${currentYear}`);
        const policySnapshot = await policyRef.once("value");
        const policy = policySnapshot.val() as Policy | null;
        
        if (policy && policy.collegeId === collegeId) {
          // ✅ Add new leave type to all role allocations with default 0
          const newLeaveCode = leaveCode.toUpperCase();
          const updatedAllocations = { ...policy.leaveAllocations };
          
          const roles = ["faculty", "lab_assistant", "office_staff", "hod", "registrar", "principal", "head_clerk"];
          let rolesUpdated = 0;
          
          for (const role of roles) {
            if (updatedAllocations[role]) {
              // Add the new leave type with 0 default
              updatedAllocations[role] = {
                ...updatedAllocations[role],
                [newLeaveCode]: 0,
              };
              rolesUpdated++;
            }
          }
          
          if (rolesUpdated > 0) {
            await policyRef.update({
              leaveAllocations: updatedAllocations,
              updatedAt: new Date().toISOString(),
            });
            policyUpdated = true;
            policyMessage = `Added to policy ${currentYear} for ${rolesUpdated} role(s)`;
          }
        } else {
          policyMessage = "No active policy found for your college";
        }
      } catch (policyError) {
        console.error("Error updating policy:", policyError);
        policyMessage = "Failed to update policy";
      }
    }

    // ✅ Audit log with policy update info
    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name || "Unknown",
      userRole: "head_clerk",
      action: "LEAVE_TYPE_CREATED",
      module: "leaveTypes",
      targetId: leaveTypeId,
      details: JSON.stringify({
        leaveCode: leaveCode.toUpperCase(),
        leaveName: leaveName,
        deductsBalance: deductsBalance !== false,
        collegeId: collegeId,
        addToPolicy: addToPolicy,
        policyUpdated: policyUpdated,
        policyMessage: policyMessage,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      leaveType: leaveTypeData,
      policyUpdated,
      policyMessage,
    });
  } catch (error) {
    console.error("Error creating leave type:", error);
    return NextResponse.json({ error: "Failed to create leave type" }, { status: 500 });
  }
}