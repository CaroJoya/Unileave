// app/api/super-admin/users/[uid]/permanent-delete/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { createAuditLog } from "@/lib/services/audit-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const { uid } = await params;
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
    const adminData = adminSnapshot.val();
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (uid === decodedToken.uid) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const userSnapshot = await rtdb.ref(`users/${uid}`).once("value");
    const userData = userSnapshot.val();

    if (!userData) {
      try {
        await auth.deleteUser(uid);
        return NextResponse.json({ 
          success: true, 
          message: "User deleted from Auth (RTDB user not found)" 
        });
      } catch {
        return NextResponse.json({ 
          error: "User not found in database", 
          details: "User may already be deleted" 
        }, { status: 404 });
      }
    }

    // ============ ROLE UNASSIGNMENT LOGIC ============
    const unassignmentLogs: string[] = [];
    const userRoles: string[] = userData.roles || [];

    // 1. Check if user is HOD - unassign from department
    if (userRoles.includes("hod") && userData.departmentId) {
      console.log(`🔍 User ${uid} is HOD of department ${userData.departmentId}, unassigning...`);
      
      const deptSnapshot = await rtdb.ref(`departments/${userData.departmentId}`).once("value");
      const dept = deptSnapshot.val();
      
      if (dept && dept.hodId === uid) {
        await rtdb.ref(`departments/${userData.departmentId}`).update({
          hodId: null,
          hodName: null,
          updatedAt: new Date().toISOString(),
        });
        
        unassignmentLogs.push(`Unassigned HOD from department "${dept.name || userData.departmentId}"`);
        console.log(`✅ Unassigned HOD from department ${userData.departmentId}`);
      }
    }

    // 2. Check if user is Registrar - unassign from Office department
    if (userRoles.includes("registrar") && userData.departmentId) {
      console.log(`🔍 User ${uid} is Registrar of department ${userData.departmentId}, unassigning...`);
      
      const deptSnapshot = await rtdb.ref(`departments/${userData.departmentId}`).once("value");
      const dept = deptSnapshot.val();
      
      if (dept && dept.hodId === uid) {
        await rtdb.ref(`departments/${userData.departmentId}`).update({
          hodId: null,
          hodName: null,
          updatedAt: new Date().toISOString(),
        });
        
        unassignmentLogs.push(`Unassigned Registrar from department "${dept.name || userData.departmentId}"`);
        console.log(`✅ Unassigned Registrar from department ${userData.departmentId}`);
      }
    }

    // 3. Check if user is Principal - unassign from college
    if (userRoles.includes("principal") && userData.collegeId) {
      console.log(`🔍 User ${uid} is Principal of college ${userData.collegeId}, unassigning...`);
      
      const collegeSnapshot = await rtdb.ref(`colleges/${userData.collegeId}`).once("value");
      const college = collegeSnapshot.val();
      
      if (college && college.principalId === uid) {
        await rtdb.ref(`colleges/${userData.collegeId}`).update({
          principalId: null,
          principalName: null,
          updatedAt: new Date().toISOString(),
        });
        
        unassignmentLogs.push(`Unassigned Principal from college "${college.name || userData.collegeId}"`);
        console.log(`✅ Unassigned Principal from college ${userData.collegeId}`);
      }
    }

    // ============ DELETE USER ============
    let authDeleted = false;
    try {
      await auth.deleteUser(uid);
      authDeleted = true;
    } catch (authError) {
      console.error("Auth deletion error - continuing with RTDB deletion:", authError);
    }

    // Get user data before deletion for audit log
    const userEmail = userData.email || uid;
    const userName = userData.name || "Unknown User";

    // Delete from RTDB
    await rtdb.ref(`users/${uid}`).remove();

    // ============ AUDIT LOGS ============
    // Log the deletion
    await createAuditLog({
      userId: decodedToken.uid,
      userName: adminData.name || "Super Admin",
      userRole: "super_admin",
      action: "USER_DELETED",
      module: "users",
      targetId: uid,
      targetUser: userEmail,
      details: {
        deletedUser: userName,
        userRoles: userRoles,
        authDeleted: authDeleted,
        unassignments: unassignmentLogs,
        unassignedCount: unassignmentLogs.length,
      },
    });

    // Log each unassignment separately for better tracking
    // ✅ FIXED: Added explicit type for 'logMessage'
    for (const logMessage of unassignmentLogs) {
      await createAuditLog({
        userId: decodedToken.uid,
        userName: adminData.name || "Super Admin",
        userRole: "super_admin",
        action: "ROLE_UNASSIGNED",
        module: "departments",
        targetId: uid,
        targetUser: userEmail,
        details: {
          action: logMessage,
          deletedUser: userName,
          userRole: userRoles.find((r: string) => ["hod", "registrar", "principal"].includes(r)) || "unknown",
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      authDeleted,
      unassignments: unassignmentLogs,
      message: `User deleted${authDeleted ? '' : ' (Auth deletion failed)'}${unassignmentLogs.length > 0 ? ` - ${unassignmentLogs.length} role(s) unassigned` : ''}`
    });
  } catch (error) {
    console.error("Error permanently deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}