// app/api/principal/overwork/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface OverworkEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  departmentId: string;
  hours: number;
  workDate: string;
  reason: string;
  status: string;
}

interface User {
  uid: string;
  roles: string[];
  collegeId: string;
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
    const principalId = decodedToken.uid;

    const principalSnapshot = await rtdb.ref(`users/${principalId}`).once("value");
    const principalData = principalSnapshot.val() as User | null;

    if (!principalData?.roles?.includes("principal")) {
      return NextResponse.json({ error: "Not authorized - Principal only" }, { status: 403 });
    }

    const collegeId = principalData.collegeId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const allUsers = usersSnapshot.val() as Record<string, User> | null || {};
    
    const collegeUserIds = Object.entries(allUsers)
      .filter(([, user]) => user.collegeId === collegeId)
      .map(([uid]) => uid);

    const overworkSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allEntries = overworkSnapshot.val() as Record<string, OverworkEntry> | null || {};

    const pendingEntries = Object.values(allEntries)
      .filter(entry => 
        collegeUserIds.includes(entry.userId) && 
        entry.status === "pending"
      )
      .sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime());

    return NextResponse.json({ entries: pendingEntries });
  } catch (error) {
    console.error("Error fetching principal overwork:", error);
    return NextResponse.json({ error: "Failed to fetch overwork entries" }, { status: 500 });
  }
}