// app/api/super-admin/departments/[id]/assign-registrar/route.ts
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const userData = userSnapshot.val();
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { registrarId } = body;

    const deptRef = rtdb.ref(`departments/${id}`);
    const deptSnapshot = await deptRef.once("value");
    const existingDept = deptSnapshot.val();

    if (!existingDept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    if (registrarId === "none" || !registrarId) {
      if (existingDept.hodId) {
        const oldRegistrarRef = rtdb.ref(`users/${existingDept.hodId}`);
        await oldRegistrarRef.update({
          departmentId: null,
          departmentName: null,
          updatedAt: new Date().toISOString(),
        });
      }

      await deptRef.update({
        hodId: null,
        hodName: null,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, message: "Registrar unassigned successfully" });
    }

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val();

    if (!registrarData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!registrarData.roles || !registrarData.roles.includes("registrar")) {
      return NextResponse.json({ error: "User does not have the 'registrar' role" }, { status: 400 });
    }

    if (existingDept.hodId && existingDept.hodId !== registrarId) {
      const oldRegistrarRef = rtdb.ref(`users/${existingDept.hodId}`);
      await oldRegistrarRef.update({
        departmentId: null,
        departmentName: null,
        updatedAt: new Date().toISOString(),
      });
    }

    await deptRef.update({
      hodId: registrarId,
      hodName: registrarData.name,
      updatedAt: new Date().toISOString(),
    });

    await rtdb.ref(`users/${registrarId}`).update({
      departmentId: id,
      departmentName: existingDept.name,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Registrar assigned successfully" });
  } catch (error) {
    console.error("Error assigning Registrar:", error);
    return NextResponse.json({ error: "Failed to assign Registrar" }, { status: 500 });
  }
}