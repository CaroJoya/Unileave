// app/api/registrar/comp-off/route.ts - FIXED
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface CompOffCredit {
  id: string;
  userId: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  departmentId: string;
  status: string;
  isEmployed: boolean;
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
    const registrarId = decodedToken.uid;

    const registrarSnapshot = await rtdb.ref(`users/${registrarId}`).once("value");
    const registrarData = registrarSnapshot.val() as User | null;

    if (!registrarData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const collegeId = registrarData.collegeId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, User> | null || {};
    
    const staffUserIds = Object.entries(users)
      .filter(([, user]) => 
        user.collegeId === collegeId && 
        (user.roles?.includes("office_staff") || user.roles?.includes("head_clerk"))
      )
      .map(([uid]) => uid);

    const creditsSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCredits = creditsSnapshot.val() as Record<string, CompOffCredit> | null || {};

    const credits: (CompOffCredit & { userName: string })[] = [];

    for (const [id, credit] of Object.entries(allCredits)) {
      if (staffUserIds.includes(credit.userId) && credit.status === "pending_approval") {
        const user = users[credit.userId];
        credits.push({
          ...credit,
          id,
          userName: user?.name || "Unknown",
        });
      }
    }

    return NextResponse.json({ credits });
  } catch (error) {
    console.error("Error fetching comp-off credits:", error);
    return NextResponse.json({ error: "Failed to fetch comp-off credits" }, { status: 500 });
  }
}