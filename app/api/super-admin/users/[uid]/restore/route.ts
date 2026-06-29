// app/api/super-admin/users/[uid]/restore/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { createAuditLog } from "@/lib/services/audit-service";

interface User {
  status: string;
  roles?: string[];
  name?: string;
  email?: string;
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
    const adminId = decodedToken.uid;
    
    const adminSnapshot = await rtdb.ref(`users/${adminId}`).once("value");
    const adminData = adminSnapshot.val() as User | null;
    
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

    const restoredAt = new Date().toISOString();
    await userRef.update({
      status: "active",
      deletedAt: null,
      deletedBy: null,
      restoredAt,
      restoredBy: adminId,
      updatedAt: new Date().toISOString(),
    });

    await createAuditLog({
      userId: adminId,
      userName: adminData.name || "Unknown Admin",
      userRole: "super_admin",
      action: "USER_RESTORED",
      module: "users",
      targetId: uid,
      targetUser: userData.email,
      oldData: { status: userData.status, deletedAt: userData.deletedAt },
      newData: { status: "active", restoredAt },
      details: { restoredBy: adminId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring user:", error);
    return NextResponse.json({ error: "Failed to restore user" }, { status: 500 });
  }
}