// lib/services/notification-service.ts
import { rtdb } from "@/lib/firebase/admin";
import { NotificationType, NotificationTitles } from "@/lib/constants/notification-types";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata: string | null;
  createdAt: string;
  readAt: string | null;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  metadata = {},
}: CreateNotificationParams): Promise<string> {
  if (!rtdb) {
    console.warn("RTDB not initialized, skipping notification");
    return "";
  }

  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const finalTitle = title || NotificationTitles[type] || type;

  const notification: Omit<Notification, 'id'> = {
    userId,
    title: finalTitle,
    message,
    type,
    isRead: false,
    metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  try {
    await rtdb.ref(`notifications/${notificationId}`).set(notification);
    return notificationId;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return "";
  }
}

export async function markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
  if (!rtdb) return false;

  try {
    const snapshot = await rtdb.ref(`notifications/${notificationId}`).once("value");
    const notification = snapshot.val() as Notification | null;
    
    if (!notification || notification.userId !== userId) {
      return false;
    }
    
    await rtdb.ref(`notifications/${notificationId}`).update({
      isRead: true,
      readAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return false;
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  if (!rtdb) return false;

  try {
    const snapshot = await rtdb.ref("notifications").once("value");
    const notifications = snapshot.val() as Record<string, Notification> | null || {};
    
    const updates: Record<string, unknown> = {};
    for (const [id, notif] of Object.entries(notifications)) {
      if (notif.userId === userId && !notif.isRead) {
        updates[`${id}/isRead`] = true;
        updates[`${id}/readAt`] = new Date().toISOString();
      }
    }
    
    if (Object.keys(updates).length > 0) {
      await rtdb.ref("notifications").update(updates);
    }
    return true;
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    return false;
  }
}

export async function getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
  if (!rtdb) return [];

  try {
    const snapshot = await rtdb.ref("notifications").once("value");
    const allNotifications = snapshot.val() as Record<string, Notification> | null || {};
    
    const userNotifications = Object.values(allNotifications)
      .filter((notification): notification is Notification => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    
    return userNotifications;
  } catch (error) {
    console.error("Failed to get user notifications:", error);
    return [];
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!rtdb) return 0;

  try {
    const snapshot = await rtdb.ref("notifications").once("value");
    const allNotifications = snapshot.val() as Record<string, Notification> | null || {};
    
    const unreadCount = Object.values(allNotifications).filter(
      (notification): notification is Notification => notification.userId === userId && !notification.isRead
    ).length;
    
    return unreadCount;
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return 0;
  }
}