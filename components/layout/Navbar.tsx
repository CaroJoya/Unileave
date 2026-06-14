// components/layout/Navbar.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bell,
  Menu,
  LogOut,
  User,
  LayoutDashboard,
  FilePlus2,
  ListChecks,
  BarChart3,
  CalendarDays,
  Award,
  Clock,
  Building2,
  Users,
  Settings,
  Umbrella,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { RoleBadge } from "./RoleBadge";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function Navbar() {
  const router = useRouter();
  const { user, userRoles, isAuthenticated, logout } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    
    try {
      const response = await fetch("/api/notifications");
      const data = await response.json();
      
      if (response.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications?.filter((n: Notification) => !n.isRead).length || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [isAuthenticated, user]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === id ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "PUT",
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, isRead: true }))
        );
        setUnreadCount(0);
        toast.success("All notifications marked as read");
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark all as read");
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const loadNotifications = async () => {
        await fetchNotifications();
      };
      loadNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user, fetchNotifications]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getNavItems = () => {
    const items: { href: string; label: string; icon: React.ReactNode }[] = [];

    if (userRoles.includes("super_admin")) {
      items.push(
        { href: "/super-admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/super-admin/departments", label: "Departments", icon: <Building2 className="h-4 w-4" /> },
        { href: "/super-admin/users", label: "Users", icon: <Users className="h-4 w-4" /> }
      );
    } else if (userRoles.includes("head_clerk")) {
      items.push(
        { href: "/headclerk/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/headclerk/leave-types", label: "Leave Types", icon: <Settings className="h-4 w-4" /> },
        { href: "/headclerk/attendance", label: "Attendance", icon: <CalendarDays className="h-4 w-4" /> },
        { href: "/headclerk/faculty", label: "Faculty", icon: <Users className="h-4 w-4" /> }
      );
    } else if (userRoles.includes("hod")) {
      items.push(
        { href: "/hod/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/hod/faculty-requests", label: "Leave Requests", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/hod/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
        { href: "/hod/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> },
        { href: "/hod/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> }
      );
    } else if (userRoles.includes("registrar")) {
      items.push(
        { href: "/registrar/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/registrar/all-leaves", label: "Leave Requests", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/registrar/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
        { href: "/registrar/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> },
        { href: "/registrar/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> },
        { href: "/registrar/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> }
      );
    } else {
      items.push(
        { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/request-leave", label: "Request Leave", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/status", label: "Status", icon: <ListChecks className="h-4 w-4" /> },
        { href: "/stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> },
        { href: "/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> },
        { href: "/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
        { href: "/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> }
      );
    }

    items.push({ href: "/profile", label: "Profile", icon: <User className="h-4 w-4" /> });
    return items;
  };

  const navItems = getNavItems();

  if (!isAuthenticated) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">UniLeave</span>
          </Link>

          <div className="hidden md:flex md:items-center md:space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center space-x-1 text-sm font-medium text-gray-700 transition-colors hover:text-primary"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      Mark all as read
                    </Button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`flex flex-col items-start p-3 cursor-pointer ${
                        !notification.isRead ? "bg-primary/5" : ""
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="font-medium text-sm">{notification.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {notification.message}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                {notifications.length > 5 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="justify-center text-center text-primary"
                      onClick={() => router.push("/notifications")}
                    >
                      View all notifications
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.name ? getInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <div className="mt-1">
                      <RoleBadge roles={userRoles} />
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[250px] sm:w-[300px]">
                <div className="flex flex-col space-y-4 mt-8">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center space-x-2 text-sm font-medium text-gray-700 transition-colors hover:text-primary"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  <div className="border-t pt-4">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center space-x-2 text-sm font-medium text-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}