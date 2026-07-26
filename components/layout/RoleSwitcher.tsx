"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Users, User, Shield, Building2, LayoutGrid } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRoleStore } from "@/store/roleStore";
import { ROLE_PRIORITY } from "@/types/roles";

interface RoleOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  description: string;
  priority: number;
}

export function RoleSwitcher() {
  const router = useRouter();
  const { userRoles } = useAuthStore();
  const { currentRole, setCurrentRole } = useRoleStore();
  const [open, setOpen] = useState(false);

  const roleConfigs = useMemo((): Record<string, RoleOption> => ({
    super_admin: {
      id: "super_admin",
      label: "Super Admin",
      icon: <Shield className="h-4 w-4" />,
      href: "/super-admin/dashboard",
      description: "Manage college, departments, and users",
      priority: ROLE_PRIORITY.super_admin,
    },
    head_clerk: {
      id: "head_clerk",
      label: "Head Clerk",
      icon: <LayoutGrid className="h-4 w-4" />,
      href: "/headclerk/dashboard",
      description: "Configure leave policies, manage attendance",
      priority: ROLE_PRIORITY.head_clerk,
    },
    principal: {
      id: "principal",
      label: "Principal",
      icon: <Shield className="h-4 w-4" />,
      href: "/principal/dashboard",
      description: "Final approvals, override eligible leaves",
      priority: ROLE_PRIORITY.principal,
    },
    registrar: {
      id: "registrar",
      label: "Registrar",
      icon: <Building2 className="h-4 w-4" />,
      href: "/registrar/dashboard",
      description: "Approve office staff leaves, generate reports",
      priority: ROLE_PRIORITY.registrar,
    },
    hod: {
      id: "hod",
      label: "HOD",
      icon: <Users className="h-4 w-4" />,
      href: "/hod/dashboard",
      description: "Approve faculty leaves, manage department",
      priority: ROLE_PRIORITY.hod,
    },
    faculty: {
      id: "faculty",
      label: "Faculty",
      icon: <User className="h-4 w-4" />,
      href: "/dashboard",
      description: "Request leave, view status, track overwork",
      priority: ROLE_PRIORITY.faculty,
    },
    lab_assistant: {
      id: "lab_assistant",
      label: "Lab Assistant",
      icon: <User className="h-4 w-4" />,
      href: "/dashboard",
      description: "Request leave, view status, track overwork",
      priority: ROLE_PRIORITY.lab_assistant,
    },
    office_staff: {
      id: "office_staff",
      label: "Office Staff",
      icon: <User className="h-4 w-4" />,
      href: "/dashboard",
      description: "Request leave, view status, track overwork",
      priority: ROLE_PRIORITY.office_staff,
    },
  }), []);

  // Get available roles for the user
  const availableRoles = useMemo(() => {
    const roles = userRoles
      .map(role => roleConfigs[role])
      .filter(Boolean) as RoleOption[];
    
    // ✅ FIX: If user has super_admin, ALWAYS add head_clerk as an option
    if (userRoles.includes("super_admin")) {
      const headClerkConfig = roleConfigs["head_clerk"];
      if (headClerkConfig && !roles.some(r => r.id === "head_clerk")) {
        roles.push(headClerkConfig);
      }
    }
    
    return roles.sort((a, b) => a.priority - b.priority);
  }, [userRoles, roleConfigs]);

  // Auto-select highest priority role if none selected
  useEffect(() => {
    if (availableRoles.length > 0 && !currentRole) {
      setCurrentRole(availableRoles[0].id);
    }
  }, [availableRoles, currentRole, setCurrentRole]);

  const currentRoleConfig = currentRole ? roleConfigs[currentRole] : null;

  const switchRole = (roleId: string) => {
    const config = roleConfigs[roleId];
    if (!config) return;
    
    setCurrentRole(roleId);
    setOpen(false);
    router.push(config.href);
  };

  // ✅ FIX: Always show for Super Admin (even if only 1 role visible)
  // But hide for normal users with only 1 role
  const shouldShow = availableRoles.length > 1 || userRoles.includes("super_admin");

  if (!shouldShow) {
    return null;
  }

  const getRoleIcon = (roleId: string) => {
    const config = roleConfigs[roleId];
    return config?.icon || <User className="h-4 w-4" />;
  };

  // Check if Super Admin is switching to Head Clerk
  const isSuperAdminActingAsHeadClerk = 
    userRoles.includes("super_admin") && 
    currentRole === "head_clerk";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 h-9 px-3 border-2"
        >
          {currentRoleConfig && (
            <>
              {getRoleIcon(currentRoleConfig.id)}
              <span className="font-medium">{currentRoleConfig.label}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch Role
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableRoles.map((role) => {
          const isSuperAdminToHeadClerk = 
            userRoles.includes("super_admin") && 
            role.id === "head_clerk" && 
            !userRoles.includes("head_clerk");
          
          return (
            <DropdownMenuItem
              key={role.id}
              className={`flex items-start gap-3 py-3 px-3 cursor-pointer ${
                currentRole === role.id ? "bg-primary/5" : ""
              }`}
              onClick={() => switchRole(role.id)}
            >
              <div className="mt-0.5">{role.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{role.label}</span>
                  {currentRole === role.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {role.description}
                </p>
                {isSuperAdminToHeadClerk && (
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    🔑 Acting as Head Clerk
                  </p>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
        
        {isSuperAdminActingAsHeadClerk && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-2 text-xs text-blue-600 bg-blue-50 rounded-md mx-2">
              🔑 You are acting as Head Clerk. All changes affect your college only.
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}