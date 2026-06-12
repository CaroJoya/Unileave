import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

export async function PUT(request: Request) {
  try {
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
    
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val();
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { principalId } = body;

    if (!principalId) {
      return NextResponse.json({ error: "Principal ID is required" }, { status: 400 });
    }

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val();

    if (!principalData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!principalData.roles?.includes("principal")) {
      return NextResponse.json({ error: "User does not have principal role" }, { status: 400 });
    }

    await rtdb.ref("colleges/college_001").update({
      principalId,
      principalName: principalData.name,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error assigning principal:", error);
    return NextResponse.json({ error: "Failed to assign principal" }, { status: 500 });
  }
}