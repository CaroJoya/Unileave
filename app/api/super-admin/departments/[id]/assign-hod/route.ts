import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
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

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val();
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { hodId } = body; // Can be a string (UID) or "none"

    const deptRef = rtdb.ref(`departments/${id}`);
    const deptSnapshot = await deptRef.once("value");
    const existingDept = deptSnapshot.val();

    if (!existingDept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Handle un-assigning HOD
    if (hodId === "none" || !hodId) {
      // If there was a previous HOD, clear their department reference
      if (existingDept.hodId) {
        const oldHodRef = rtdb.ref(`users/${existingDept.hodId}`);
        await oldHodRef.update({
          departmentId: null,
          departmentName: null,
          updatedAt: new Date().toISOString(),
        });
      }

      // Clear HOD from department
      await deptRef.update({
        hodId: null,
        hodName: null,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, message: "HOD unassigned successfully" });
    }

    // Fetch the new HOD user data
    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val();

    if (!hodData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Validate that the user has the 'hod' role
    if (!hodData.roles || !hodData.roles.includes("hod")) {
      return NextResponse.json({ error: "User does not have the 'hod' role" }, { status: 400 });
    }

    // If there was a previous HOD, clear their department reference
    if (existingDept.hodId && existingDept.hodId !== hodId) {
      const oldHodRef = rtdb.ref(`users/${existingDept.hodId}`);
      await oldHodRef.update({
        departmentId: null,
        departmentName: null,
        updatedAt: new Date().toISOString(),
      });
    }

    // Update the department with the new HOD
    await deptRef.update({
      hodId: hodId,
      hodName: hodData.name,
      updatedAt: new Date().toISOString(),
    });

    // Update the HOD user's department reference
    await rtdb.ref(`users/${hodId}`).update({
      departmentId: id,
      departmentName: existingDept.name,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "HOD assigned successfully" });
  } catch (error) {
    console.error("Error assigning HOD:", error);
    return NextResponse.json({ error: "Failed to assign HOD" }, { status: 500 });
  }
}