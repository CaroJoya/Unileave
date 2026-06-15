// app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { markAllNotificationsAsRead } from "@/lib/services/notification-service";

export async function PATCH() {
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
    const userId = decodedToken.uid;

    await markAllNotificationsAsRead(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 });
  }
}