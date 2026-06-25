// app/api/super-admin/departments/hod-candidates/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface User {
  name: string;
  email: string;
  roles?: string[];
  status?: string;
  departmentId?: string;
  departmentName?: string;
}

export async function GET() {
  try {
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

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() || {};

    const hodCandidates = Object.entries(users)
      .filter(([, user]) => {
        const userData = user as User;
        return userData.roles?.includes("hod") && userData.status === "active";
      })
      .map(([uid, user]) => {
        const userData = user as User;
        return {
          uid,
          name: userData.name,
          email: userData.email,
          departmentId: userData.departmentId,
          departmentName: userData.departmentName,
        };
      });

    return NextResponse.json({ candidates: hodCandidates });
  } catch (error) {
    console.error("Error fetching HOD candidates:", error);
    return NextResponse.json({ error: "Failed to fetch HOD candidates" }, { status: 500 });
  }
}