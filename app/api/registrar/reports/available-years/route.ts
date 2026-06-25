// app/api/registrar/reports/available-years/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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

    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as { roles?: string[] } | null;

    if (!userData?.roles?.includes("registrar")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get archived policies to get available years
    const archivedSnapshot = await rtdb.ref("archivedPolicies").once("value");
    const archived = archivedSnapshot.val() || {};

    const years = Object.keys(archived).sort().reverse();

    return NextResponse.json({ years });
  } catch (error) {
    console.error("Error fetching available years:", error);
    return NextResponse.json({ error: "Failed to fetch available years" }, { status: 500 });
  }
}