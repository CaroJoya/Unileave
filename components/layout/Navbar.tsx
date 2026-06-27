"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, LayoutDashboard } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRoleStore } from "@/store/roleStore";
import { RoleBadge } from "./RoleBadge";
import { NotificationBell } from "./NotificationBell";
import { MobileNav } from "./MobileNav";
import { RoleSwitcher } from "./RoleSwitcher";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const {
    user,
    userRoles,
    isAuthenticated,
    hydrationComplete,
    isLoading,
    logout,
  } = useAuthStore();

  const { currentRole, setCurrentRole } = useRoleStore();

  const handleLogout = async () => {
    await logout();
    setCurrentRole("");
    router.push("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getDashboardUrl = () => {
    if (currentRole === "hod") return "/hod/dashboard";
    if (currentRole === "registrar") return "/registrar/dashboard";
    if (currentRole === "principal") return "/principal/dashboard";
    if (currentRole === "head_clerk") return "/headclerk/dashboard";
    if (currentRole === "super_admin") return "/super-admin/dashboard";
    return "/dashboard";
  };

  const publicRoutes = [
    "/",
    "/login",
    "/forgot-password",
    "/reset-password",
  ];

  if (publicRoutes.includes(pathname)) {
    return null;
  }

  if (!hydrationComplete || isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const dashboardUrl = getDashboardUrl();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href={dashboardUrl} className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">UniLeave</span>
          </Link>

          <div className="flex items-center space-x-3">
            <RoleSwitcher />

            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.name ? getInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                    <div className="mt-1">
                      <RoleBadge roles={userRoles} />
                    </div>
                    {userRoles.length > 1 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {userRoles.map((role) => (
                          <span
                            key={role}
                            className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-600"
                          >
                            {role.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* ✅ NEW: Dashboard link */}
                <DropdownMenuItem
                  onClick={() => router.push(dashboardUrl)}
                  className="cursor-pointer"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => router.push("/profile")}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <MobileNav />
          </div>
        </div>
      </div>
    </nav>
  );
}