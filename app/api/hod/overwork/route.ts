// app/api/hod/overwork/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
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

    if (!auth || !rtdb) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const hodId = decodedToken.uid;

    const hodSnapshot = await rtdb.ref(`users/${hodId}`).once("value");
    const hodData = hodSnapshot.val() as User | null;

    if (!hodData?.roles?.includes("hod")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const departmentId = hodData.departmentId;

    // Get overwork entries
    const entriesSnapshot = await rtdb.ref("overworkEntries").once("value");
    const allEntries = entriesSnapshot.val() as Record<string, OverworkEntry> | null || {};

    const entries = Object.values(allEntries)
      .filter((entry) => 
        entry.departmentId === departmentId && 
        entry.status === "pending"
      )
      .sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime());

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching overwork entries:", error);
    return NextResponse.json({ error: "Failed to fetch overwork entries" }, { status: 500 });
  }
}