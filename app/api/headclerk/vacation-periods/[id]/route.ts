// app/api/super-admin/departments/[id]/assign-registrar/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface Department {
  id: string;
  name: string;
  collegeId: string;
  hodId: string | null;
  hodName: string | null;
  registrarId: string | null;
  registrarName: string | null;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserData {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId?: string;
  departmentId?: string;
  departmentName?: string;
  status?: string;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Extract the department ID from the URL
    const { id } = await params;

    // 2. Verify authentication
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

    // 3. Verify the user is a Super Admin
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserData | null;
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const adminCollegeId = userData.collegeId;
    if (!adminCollegeId) {
      return NextResponse.json({ error: "Admin has no college assigned" }, { status: 400 });
    }

    // 4. Get the new registrar ID from the request body
    const body = await request.json();
    const { registrarId } = body;

    // 5. Get the department data
    const deptRef = rtdb.ref(`departments/${id}`);
    const deptSnapshot = await deptRef.once("value");
    const existingDept = deptSnapshot.val() as Department | null;

    if (!existingDept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // ✅ CRITICAL FIX: Verify department belongs to admin's college
    if (existingDept.collegeId !== adminCollegeId) {
      return NextResponse.json({ 
        error: "Department does not belong to your college" 
      }, { status: 403 });
    }

    // 6. Handle unassignment (if registrarId is "none" or empty)
    if (registrarId === "none" || !registrarId) {
      // If there's an existing assigned user, clear their department field
      if (existingDept.registrarId) {
        const oldRegistrarRef = rtdb.ref(`users/${existingDept.registrarId}`);
        await oldRegistrarRef.update({
          departmentId: null,
          departmentName: null,
          updatedAt: new Date().toISOString(),
        });
      }

      // Clear the department's registrar field
      await deptRef.update({
        registrarId: null,
        registrarName: null,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ 
        success: true, 
        message: "Registrar unassigned successfully" 
      });
    }

    // 7. Get the new registrar's data
    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as UserData | null;

    if (!registrarData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ CRITICAL FIX: Verify registrar belongs to the same college
    if (registrarData.collegeId !== adminCollegeId) {
      return NextResponse.json({ 
        error: "User does not belong to your college" 
      }, { status: 403 });
    }

    // 8. Verify the user has the 'registrar' role
    if (!registrarData.roles || !registrarData.roles.includes("registrar")) {
      return NextResponse.json({ 
        error: "User does not have the 'registrar' role" 
      }, { status: 400 });
    }

    // 9. If there is an old registrar, unassign them first
    if (existingDept.registrarId && existingDept.registrarId !== registrarId) {
      const oldRegistrarRef = rtdb.ref(`users/${existingDept.registrarId}`);
      await oldRegistrarRef.update({
        departmentId: null,
        departmentName: null,
        updatedAt: new Date().toISOString(),
      });
    }

    // 10. Assign the new registrar to the department
    await deptRef.update({
      registrarId: registrarId,
      registrarName: registrarData.name,
      updatedAt: new Date().toISOString(),
    });

    // 11. Update the user's record with the department details
    await rtdb.ref(`users/${registrarId}`).update({
      departmentId: id,
      departmentName: existingDept.name,
      updatedAt: new Date().toISOString(),
    });

    // 12. Log the action
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: decodedToken.uid,
      userName: userData.name || "Super Admin",
      userRole: "super_admin",
      action: "REGISTRAR_ASSIGNED",
      module: "departments",
      targetId: id,
      targetUser: registrarData.email,
      details: JSON.stringify({
        departmentName: existingDept.name,
        registrarName: registrarData.name,
        registrarId: registrarId,
        collegeId: adminCollegeId,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      message: "Registrar assigned successfully" 
    });

  } catch (error) {
    console.error("Error assigning Registrar:", error);
    return NextResponse.json({ error: "Failed to assign Registrar" }, { status: 500 });
  }
}