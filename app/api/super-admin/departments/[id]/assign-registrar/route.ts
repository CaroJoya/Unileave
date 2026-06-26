import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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
    const userData = userSnapshot.val();
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // 4. Get the new registrar ID from the request body
    const body = await request.json();
    const { registrarId } = body;

    // 5. Get the department data
    const deptRef = rtdb.ref(`departments/${id}`);
    const deptSnapshot = await deptRef.once("value");
    const existingDept = deptSnapshot.val();

    if (!existingDept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // 6. Handle unassignment (if registrarId is "none" or empty)
    if (registrarId === "none" || !registrarId) {
      // If there's an existing assigned user, clear their department field
      if (existingDept.hodId) {
        const oldRegistrarRef = rtdb.ref(`users/${existingDept.hodId}`);
        await oldRegistrarRef.update({
          departmentId: null,
          departmentName: null,
          updatedAt: new Date().toISOString(),
        });
      }

      // Clear the department's registrar field
      await deptRef.update({
        hodId: null,
        hodName: null,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, message: "Registrar unassigned successfully" });
    }

    // 7. Get the new registrar's data
    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val();

    if (!registrarData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 8. Verify the user has the 'registrar' role
    if (!registrarData.roles || !registrarData.roles.includes("registrar")) {
      return NextResponse.json({ error: "User does not have the 'registrar' role" }, { status: 400 });
    }

    // 9. If there is an old registrar, unassign them first
    if (existingDept.hodId && existingDept.hodId !== registrarId) {
      const oldRegistrarRef = rtdb.ref(`users/${existingDept.hodId}`);
      await oldRegistrarRef.update({
        departmentId: null,
        departmentName: null,
        updatedAt: new Date().toISOString(),
      });
    }

    // 10. Assign the new registrar to the department
    await deptRef.update({
      hodId: registrarId,
      hodName: registrarData.name,
      updatedAt: new Date().toISOString(),
    });

    // 11. Update the user's record with the department details
    await rtdb.ref(`users/${registrarId}`).update({
      departmentId: id,
      departmentName: existingDept.name,
      updatedAt: new Date().toISOString(),
    });

    // 12. Log the action (Optional but good practice)
    // await logAuditAction(...);

    return NextResponse.json({ success: true, message: "Registrar assigned successfully" });

  } catch (error) {
    console.error("Error assigning Registrar:", error);
    return NextResponse.json({ error: "Failed to assign Registrar" }, { status: 500 });
  }
}