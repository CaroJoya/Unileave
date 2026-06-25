// app/api/hod/comp-off/route.ts - FIXED
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
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as User | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const departmentId = hodData.departmentId;

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, User> | null || {};
    
    const departmentUserIds = Object.entries(users)
      .filter(([, user]) => 
        user.departmentId === departmentId && 
        (user.roles?.includes("faculty") || user.roles?.includes("lab_assistant"))
      )
      .map(([uid]) => uid);

    const creditsSnapshot = await rtdb.ref("compOffCredits").once("value");
    const allCredits = creditsSnapshot.val() as Record<string, CompOffCredit> | null || {};

    const credits: (CompOffCredit & { userName: string })[] = [];

    for (const [id, credit] of Object.entries(allCredits)) {
      if (departmentUserIds.includes(credit.userId) && credit.status === "pending_approval") {
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