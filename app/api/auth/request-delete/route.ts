// app/api/auth/request-delete/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { createAuditLog } from "@/lib/services/audit-service";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userId = decodedToken.uid;

    const snapshot = await rtdb.ref(`users/${userId}`).once("value");
    const userData = snapshot.val();

    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // ============ ROLE UNASSIGNMENT LOGIC (SELF-DELETION) ============
    const unassignmentLogs: string[] = [];
    const userRoles = userData.roles || [];

    // 1. Check if user is HOD
    if (userRoles.includes("hod") && userData.departmentId) {
      const deptSnapshot = await rtdb.ref(`departments/${userData.departmentId}`).once("value");
      const dept = deptSnapshot.val();
      
      if (dept && dept.hodId === userId) {
        await rtdb.ref(`departments/${userData.departmentId}`).update({
          hodId: null,
          hodName: null,
          updatedAt: new Date().toISOString(),
        });
        unassignmentLogs.push(`Unassigned HOD from department "${dept.name || userData.departmentId}"`);
      }
    }

    // 2. Check if user is Registrar
    if (userRoles.includes("registrar") && userData.departmentId) {
      const deptSnapshot = await rtdb.ref(`departments/${userData.departmentId}`).once("value");
      const dept = deptSnapshot.val();
      
      if (dept && dept.hodId === userId) {
        await rtdb.ref(`departments/${userData.departmentId}`).update({
          hodId: null,
          hodName: null,
          updatedAt: new Date().toISOString(),
        });
        unassignmentLogs.push(`Unassigned Registrar from department "${dept.name || userData.departmentId}"`);
      }
    }

    // 3. Check if user is Principal
    if (userRoles.includes("principal") && userData.collegeId) {
      const collegeSnapshot = await rtdb.ref(`colleges/${userData.collegeId}`).once("value");
      const college = collegeSnapshot.val();
      
      if (college && college.principalId === userId) {
        await rtdb.ref(`colleges/${userData.collegeId}`).update({
          principalId: null,
          principalName: null,
          updatedAt: new Date().toISOString(),
        });
        unassignmentLogs.push(`Unassigned Principal from college "${college.name || userData.collegeId}"`);
      }
    }

    const deletedAt = new Date().toISOString();

    await rtdb.ref(`users/${userId}`).update({
      status: "deleted",
      deletedAt: deletedAt,
      deletedBy: userId,
      updatedAt: new Date().toISOString(),
    });

    // Log self-deletion
    await createAuditLog({
      userId,
      userName: userData.name || "Unknown User",
      userRole: userData.roles?.[0] || "user",
      action: "USER_DEACTIVATED",
      module: "users",
      targetId: userId,
      targetUser: userData.email,
      oldData: { status: userData.status },
      newData: { status: "deleted", deletedAt },
      details: { 
        selfDeletion: true,
        unassignments: unassignmentLogs,
      },
    });

    // Log each unassignment
    for (const logMessage of unassignmentLogs) {
      await createAuditLog({
        userId,
        userName: userData.name || "Unknown User",
        userRole: userData.roles?.[0] || "user",
        action: "ROLE_UNASSIGNED",
        module: "departments",
        targetId: userId,
        targetUser: userData.email,
        details: {
          action: logMessage,
          selfDeletion: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Account deactivated. You have 30 days to restore.${unassignmentLogs.length > 0 ? ` ${unassignmentLogs.length} role(s) unassigned.` : ''}`,
      deletedAt,
      unassignments: unassignmentLogs,
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}