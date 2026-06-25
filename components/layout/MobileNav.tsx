// components/layout/MobileNav.tsx - Fixed version
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  LogOut,
  User,
  LayoutDashboard,
  FilePlus2,
  ListChecks,
  BarChart3,
  Award,
  Clock,
  Building2,
  Users,
  Settings,
  Umbrella,
  Shield,
  Check,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRoleStore } from "@/store/roleStore";
import { RoleBadge } from "./RoleBadge";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Role configurations for mobile
const roleConfigs: Record<string, { label: string; icon: React.ReactNode; href: string; description: string }> = {
  faculty: {
    label: "Faculty",
    icon: <User className="h-4 w-4" />,
    href: "/dashboard",
    description: "Request leave, view status",
  },
  lab_assistant: {
    label: "Lab Assistant",
    icon: <User className="h-4 w-4" />,
    href: "/dashboard",
    description: "Request leave, view status",
  },
  office_staff: {
    label: "Office Staff",
    icon: <User className="h-4 w-4" />,
    href: "/dashboard",
    description: "Request leave, view status",
  },
  hod: {
    label: "HOD",
    icon: <Users className="h-4 w-4" />,
    href: "/hod/dashboard",
    description: "Approve faculty leaves",
  },
  registrar: {
    label: "Registrar",
    icon: <Building2 className="h-4 w-4" />,
    href: "/registrar/dashboard",
    description: "Approve office staff leaves",
  },
  principal: {
    label: "Principal",
    icon: <Shield className="h-4 w-4" />,
    href: "/principal/dashboard",
    description: "Final approvals & overrides",
  },
  head_clerk: {
    label: "Head Clerk",
    icon: <Settings className="h-4 w-4" />,
    href: "/headclerk/dashboard",
    description: "Configure policies",
  },
  super_admin: {
    label: "Super Admin",
    icon: <Shield className="h-4 w-4" />,
    href: "/super-admin/dashboard",
    description: "Manage college & users",
  },
};

export function MobileNav() {
  const router = useRouter();
  const { user, userRoles, logout } = useAuthStore();
  const { currentRole, setCurrentRole } = useRoleStore();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setCurrentRole("");
    router.push("/login");
    setOpen(false);
  };

  const getDashboardUrl = () => {
    if (currentRole === "hod") return "/hod/dashboard";
    if (currentRole === "registrar") return "/registrar/dashboard";
    if (currentRole === "principal") return "/principal/dashboard";
    if (currentRole === "head_clerk") return "/headclerk/dashboard";
    if (currentRole === "super_admin") return "/super-admin/dashboard";
    return "/dashboard";
  };

  // Get staff navigation items based on current role
  const getStaffNavItems = () => {
    const items = [];
    
    // Always show staff items if user has staff role
    const hasStaffRole = userRoles.some(r => 
      ["faculty", "lab_assistant", "office_staff"].includes(r)
    );
    
    if (hasStaffRole) {
      items.push(
        { href: "/request-leave", label: "Request Leave", icon: <FilePlus2 className="h-4 w-4" /> },
        { href: "/status", label: "My Status", icon: <ListChecks className="h-4 w-4" /> },
        { href: "/stats", label: "My Stats", icon: <BarChart3 className="h-4 w-4" /> },
        { href: "/vacation", label: "Vacation", icon: <Umbrella className="h-4 w-4" /> },
        { href: "/comp-off", label: "Comp Off", icon: <Award className="h-4 w-4" /> },
        { href: "/overwork", label: "Overwork", icon: <Clock className="h-4 w-4" /> }
      );
    }
    
    return items;
  };

  const dashboardUrl = getDashboardUrl();
  const staffNavItems = getStaffNavItems();
  
  // Get available roles for the user
  const availableRoles = userRoles
    .map(role => ({
      id: role,
      ...roleConfigs[role]
    }))
    .filter(Boolean);

  const isMultiRole = availableRoles.length > 1;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[350px] overflow-y-auto">
        {/* ✅ FIX: Add SheetTitle for accessibility */}
        <SheetTitle className="sr-only">
          Navigation Menu
        </SheetTitle>
        <SheetDescription className="sr-only">
          Navigate through the application and switch between roles
        </SheetDescription>
        
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

          {/* Role Switcher Section - Only for multi-role users */}
          {isMultiRole && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground px-3 py-2">
                Switch Role
              </div>
              <div className="space-y-1">
                {availableRoles.map((role) => (
                  <button
                    key={role.id}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      currentRole === role.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    onClick={() => {
                      setCurrentRole(role.id);
                      setOpen(false);
                      router.push(role.href);
                    }}
                    aria-label={`Switch to ${role.label} role`}
                  >
                    {role.icon}
                    <span>{role.label}</span>
                    {currentRole === role.id && (
                      <Check className="h-4 w-4 ml-auto text-primary" />
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t my-3" />
            </div>
          )}

          {/* Navigation Items */}
          <div className="flex-1 space-y-1 overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground px-3 py-2">
              Menu
            </div>
            
            {/* Dashboard */}
            <Link
              href={dashboardUrl}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            {/* Staff Items */}
            {staffNavItems.map((item) => (
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

          {/* Bottom Actions */}
          <div className="border-t pt-4 mt-4 space-y-2">
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
              aria-label="Logout"
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