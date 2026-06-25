// app/api/notifications/route.ts - COMPLETE FILE WITH FIXED ESLINT
import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { getUserNotifications, getUnreadCount } from "@/lib/services/notification-service";

export async function GET(request: Request) {
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

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const notifications = await getUserNotifications(userId);
    const unreadCount = await getUnreadCount(userId);

    // Filter by unread if requested
    // ✅ Changed from 'let' to 'const' since it's not reassigned
    const filteredNotifications = unreadOnly 
      ? notifications.filter(n => !n.isRead)
      : notifications;

    // Paginate
    const total = filteredNotifications.length;
    const paginated = filteredNotifications.slice(offset, offset + limit);

    return NextResponse.json({
      notifications: paginated,
      unreadCount,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}