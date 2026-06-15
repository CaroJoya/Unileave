// app/api/notifications/route.ts
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getUserNotifications, getUnreadCount } from "@/lib/services/notification-service";

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
    const userId = decodedToken.uid;

    const notifications = await getUserNotifications(userId);
    const unreadCount = await getUnreadCount(userId);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}