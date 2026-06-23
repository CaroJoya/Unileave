// components/layout/MobileNav.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
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
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { RoleBadge } from "./RoleBadge";

export function MobileNav() {
  const router = useRouter();
  const { user, userRoles, logout } = useAuthStore();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    setOpen(false);
  };

  const getDashboardUrl = () => {
    if (userRoles.includes("super_admin")) {
      return "/super-admin/dashboard";
    } else if (userRoles.includes("head_clerk")) {
      return "/headclerk/dashboard";
    } else if (userRoles.includes("hod")) {
      return "/hod/dashboard";
    } else if (userRoles.includes("registrar")) {
      return "/registrar/dashboard";
    } else if (userRoles.includes("principal")) {
      return "/principal/dashboard";
    } else {
      return "/dashboard";
    }
  };

  const getNavItems = () => {
    const items: { href: string; label: string; icon: React.ReactNode }[] = [];

    // Super Admin
    if (userRoles.includes("super_admin")) {
      items.push(
        { href: "/super-admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/super-admin/departments", label: "Departments", icon: <Building2 className="h-4 w-4" /> },
        { href: "/super-admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
        { href: "/super-admin/audit-logs", label: "Audit Logs", icon: <ListChecks className="h-4 w-4" /> }
      );
      return items;
    }

    // Head Clerk
    if (userRoles.includes("head_clerk")) {
      items.push(
        { href: "/headclerk/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/headclerk/leave-types", label: "Leave Types", icon: <Settings className="h-4 w-4" /> },
        { href: "/headclerk/attendance", label: "Attendance", icon: <CalendarDays className="h-4 w-4" /> },
        { href: "/headclerk/faculty", label: "Faculty", icon: <Users className="h-4 w-4" /> }
      );
      return items;
    }

    // HOD
    if (userRoles.includes("hod")) {
      items.push(
        { href: "/hod/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/hod/faculty-requests", label: "Leave Requests", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/hod/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
        { href: "/hod/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> },
        { href: "/hod/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> }
      );
      // Add staff links for HOD+Faculty
      if (userRoles.includes("faculty") || userRoles.includes("lab_assistant")) {
        items.push(
          { href: "/request-leave", label: "Request Leave", icon: <FilePlus2 className="h-4 w-4" /> },
          { href: "/status", label: "Status", icon: <ListChecks className="h-4 w-4" /> },
          { href: "/stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> }
        );
      }
      return items;
    }

    // Registrar
    if (userRoles.includes("registrar")) {
      items.push(
        { href: "/registrar/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/registrar/all-leaves", label: "All Leaves", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/registrar/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
        { href: "/registrar/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> },
        { href: "/registrar/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> },
        { href: "/registrar/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> }
      );
      // Add staff links for Registrar+OS
      if (userRoles.includes("office_staff")) {
        items.push(
          { href: "/request-leave", label: "Request Leave", icon: <FilePlus2 className="h-4 w-4" /> },
          { href: "/status", label: "Status", icon: <ListChecks className="h-4 w-4" /> },
          { href: "/stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> }
        );
      }
      return items;
    }

    // Principal
    if (userRoles.includes("principal")) {
      items.push(
        { href: "/principal/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { href: "/principal/direct-approvals", label: "Direct Approvals", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/principal/override-eligible", label: "Override Eligible", icon: <AlertCircle className="h-4 w-4" /> },
        { href: "/principal/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
        { href: "/principal/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> },
        { href: "/principal/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> }
      );
      return items;
    }

    // Staff (Faculty, Lab Assistant, Office Staff)
    items.push(
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: "/request-leave", label: "Request Leave", icon: <FilePlus2 className="h-4 w-4" /> },
      { href: "/status", label: "Status", icon: <ListChecks className="h-4 w-4" /> },
      { href: "/stats", label: "Stats", icon: <BarChart3 className="h-4 w-4" /> },
      { href: "/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> },
      { href: "/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
      { href: "/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> }
    );

    return items;
  };

  const navItems = getNavItems();
  const dashboardUrl = getDashboardUrl();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[280px] sm:w-[350px]">
        <div className="flex flex-col h-full">
          {/* User Info */}
          <div className="border-b pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <p className="font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <div className="mt-1">
                  <RoleBadge roles={userRoles} />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setOpen(false)}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Logout Button - Always at the bottom */}
          <div className="border-t pt-4 mt-4 space-y-2">
            <Link
              href={dashboardUrl}
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
            <Link
              href="/profile"
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setOpen(false)}
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}