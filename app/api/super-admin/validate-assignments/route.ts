// app/api/super-admin/validate-assignments/route.ts
import { NextResponse } from "next/server";
import { getAuth, getRTDB } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { validateAndCleanAssignments } from "@/lib/utils/validate-assignments";
import { createAuditLog } from "@/lib/services/audit-service";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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

    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val();

    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Run validation and cleanup
    const result = await validateAndCleanAssignments();

    // Log the cleanup
    await createAuditLog({
      userId: decodedToken.uid,
      userName: adminData.name || "Super Admin",
      userRole: "super_admin",
      action: "ASSIGNMENTS_VALIDATED",
      module: "departments",
      details: {
        errorsCount: result.errors.length,
        cleanedCount: result.cleaned.length,
        invalidHODs: result.details.invalidHODs,
        invalidRegistrars: result.details.invalidRegistrars,
        invalidPrincipals: result.details.invalidPrincipals,
        errors: result.errors,
        cleaned: result.cleaned,
      },
    });

    return NextResponse.json({
      success: true,
      errors: result.errors,
      cleaned: result.cleaned,
      details: result.details,
      message: `Validated assignments. ${result.cleaned.length} invalid assignments cleaned.`,
    });
  } catch (error) {
    console.error("Error validating assignments:", error);
    return NextResponse.json(
      { error: "Failed to validate assignments" },
      { status: 500 }
    );
  }
}