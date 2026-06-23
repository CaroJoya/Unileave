// components/layout/RoleSwitcher.tsx
"use client";

import { useState, useEffect } from "react";
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
import { ChevronDown, Check, Users, User, Shield, Building2, Settings } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRoleStore } from "@/store/roleStore";

interface RoleOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  description: string;
}

export function RoleSwitcher() {
  const router = useRouter();
  const { userRoles } = useAuthStore();
  const { currentRole, setCurrentRole } = useRoleStore();
  const [open, setOpen] = useState(false);

  // Role configurations
  const roleConfigs: Record<string, RoleOption> = {
    faculty: {
      id: "faculty",
      label: "Faculty",
      icon: <User className="h-4 w-4" />,
      href: "/dashboard",
      description: "Request leave, view status, track overwork",
    },
    lab_assistant: {
      id: "lab_assistant",
      label: "Lab Assistant",
      icon: <User className="h-4 w-4" />,
      href: "/dashboard",
      description: "Request leave, view status, track overwork",
    },
    office_staff: {
      id: "office_staff",
      label: "Office Staff",
      icon: <User className="h-4 w-4" />,
      href: "/dashboard",
      description: "Request leave, view status, track overwork",
    },
    hod: {
      id: "hod",
      label: "HOD",
      icon: <Users className="h-4 w-4" />,
      href: "/hod/dashboard",
      description: "Approve faculty leaves, manage department",
    },
    registrar: {
      id: "registrar",
      label: "Registrar",
      icon: <Building2 className="h-4 w-4" />,
      href: "/registrar/dashboard",
      description: "Approve office staff leaves, generate reports",
    },
    principal: {
      id: "principal",
      label: "Principal",
      icon: <Shield className="h-4 w-4" />,
      href: "/principal/dashboard",
      description: "Final approvals, override eligible leaves",
    },
    head_clerk: {
      id: "head_clerk",
      label: "Head Clerk",
      icon: <Settings className="h-4 w-4" />,
      href: "/headclerk/dashboard",
      description: "Configure leave policies, manage attendance",
    },
    super_admin: {
      id: "super_admin",
      label: "Super Admin",
      icon: <Shield className="h-4 w-4" />,
      href: "/super-admin/dashboard",
      description: "Manage college, departments, and users",
    },
  };

  // Get available roles for the user
  const availableRoles = userRoles
    .map(role => roleConfigs[role])
    .filter(Boolean);

  // Auto-select first role if none selected
  useEffect(() => {
    if (availableRoles.length > 0 && !currentRole) {
      setCurrentRole(availableRoles[0].id);
    }
  }, [availableRoles, currentRole, setCurrentRole]);

  // Get current role config
  const currentRoleConfig = currentRole ? roleConfigs[currentRole] : null;

  // Handle role switch
  const switchRole = (roleId: string) => {
    const config = roleConfigs[roleId];
    if (!config) return;
    
    setCurrentRole(roleId);
    setOpen(false);
    router.push(config.href);
  };

  // If only one role, show simple button or nothing
  if (availableRoles.length <= 1) {
    return null;
  }

  // Get the appropriate icon for the current role
  const getRoleIcon = (roleId: string) => {
    const config = roleConfigs[roleId];
    return config?.icon || <User className="h-4 w-4" />;
  };

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
        
        {availableRoles.map((role) => (
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
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}