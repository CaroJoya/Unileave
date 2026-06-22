// components/layout/Navbar.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { LogOut, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { RoleBadge } from "./RoleBadge";
import { NotificationBell } from "./NotificationBell";
import { MobileNav } from "./MobileNav";

export default function Navbar() {
  const router = useRouter();
  const { user, userRoles, isAuthenticated, logout } = useAuthStore();

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

  // Function to get the correct dashboard URL based on user roles
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

  // Don't show navbar on login page
  if (!isAuthenticated) return null;

  const dashboardUrl = getDashboardUrl();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href={dashboardUrl} className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">UniLeave</span>
          </Link>

          <div className="flex items-center space-x-2">
            <NotificationBell />
            
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
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    <div className="mt-1">
                      <RoleBadge roles={userRoles} />
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Navigation */}
            <MobileNav />
          </div>
        </div>
      </div>
    </nav>
  );
}