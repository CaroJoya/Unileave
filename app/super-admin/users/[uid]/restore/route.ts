import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface User {
  status: string;
  roles?: string[];
  name?: string;
  [key: string]: unknown;
}

export async function POST(
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

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    // Check if user is super admin
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as User | null;
    
    // ✅ FIX: Check if adminData exists before accessing roles
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const userRef = rtdb.ref(`users/${uid}`);
    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.val() as User | null;

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userData.status !== "deleted") {
      return NextResponse.json({ error: "User is not deleted" }, { status: 400 });
    }

    await userRef.update({
      status: "active",
      deletedAt: null,
      deletedBy: null,
      restoredAt: new Date().toISOString(),
      restoredBy: decodedToken.uid,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring user:", error);
    return NextResponse.json({ error: "Failed to restore user" }, { status: 500 });
  }
}