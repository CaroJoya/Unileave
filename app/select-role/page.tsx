// app/select-role/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { useRoleStore } from "@/store/roleStore";
import {
  User,
  Users,
  Building2,
  Shield,
  Settings,
} from "lucide-react";

const roleConfigs: Record<string, { label: string; icon: React.ReactNode; href: string; description: string; color: string }> = {
  faculty: {
    label: "Faculty",
    icon: <User className="h-8 w-8" />,
    href: "/dashboard",
    description: "Request leave, view status, track overwork",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
  },
  lab_assistant: {
    label: "Lab Assistant",
    icon: <User className="h-8 w-8" />,
    href: "/dashboard",
    description: "Request leave, view status, track overwork",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
  },
  office_staff: {
    label: "Office Staff",
    icon: <User className="h-8 w-8" />,
    href: "/dashboard",
    description: "Request leave, view status, track overwork",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
  },
  hod: {
    label: "HOD",
    icon: <Users className="h-8 w-8" />,
    href: "/hod/dashboard",
    description: "Approve faculty leaves, manage department",
    color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400",
  },
  registrar: {
    label: "Registrar",
    icon: <Building2 className="h-8 w-8" />,
    href: "/registrar/dashboard",
    description: "Approve office staff leaves, generate reports",
    color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
  },
  principal: {
    label: "Principal",
    icon: <Shield className="h-8 w-8" />,
    href: "/principal/dashboard",
    description: "Final approvals, override eligible leaves",
    color: "bg-amber-50 border-amber-200 hover:border-amber-400",
  },
  head_clerk: {
    label: "Head Clerk",
    icon: <Settings className="h-8 w-8" />,
    href: "/headclerk/dashboard",
    description: "Configure leave policies, manage attendance",
    color: "bg-purple-50 border-purple-200 hover:border-purple-400",
  },
  super_admin: {
    label: "Super Admin",
    icon: <Shield className="h-8 w-8" />,
    href: "/super-admin/dashboard",
    description: "Manage college, departments, and users",
    color: "bg-red-50 border-red-200 hover:border-red-400",
  },
};

export default function SelectRolePage() {
  const { user, userRoles, isLoading } = useAuthStore();
  const { setCurrentRole } = useRoleStore();
  const router = useRouter();

  // If only one role, auto-select and redirect
  useEffect(() => {
    if (!isLoading && user) {
      const availableRoles = userRoles.filter(r => roleConfigs[r]);
      
      if (availableRoles.length === 1) {
        setCurrentRole(availableRoles[0]);
        router.push(roleConfigs[availableRoles[0]].href);
      }
    }
    
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, userRoles, isLoading, router, setCurrentRole]);

  const availableRoles = userRoles
    .filter(r => roleConfigs[r])
    .map(r => ({ id: r, ...roleConfigs[r] }));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || availableRoles.length <= 1) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user.name}!</h1>
        <p className="text-muted-foreground mt-2">
          You have multiple roles. Choose which one you want to use.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          You can switch roles anytime from the navbar.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 max-w-4xl w-full">
        {availableRoles.map((role) => (
          <Card 
            key={role.id}
            className={`cursor-pointer transition-all hover:shadow-lg border-2 ${role.color}`}
            onClick={() => {
              setCurrentRole(role.id);
              router.push(role.href);
            }}
          >
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <div className="p-2 rounded-full bg-white/50">
                {role.icon}
              </div>
              <div>
                <CardTitle className="text-xl">{role.label}</CardTitle>
                <CardDescription>{role.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-between text-primary">
                Continue as {role.label}
                <span className="ml-2">→</span>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-sm text-muted-foreground">
        <button
          onClick={() => {
            // If user clicks "Remember my choice" - we could store preference
            // For now, just a visual indicator
          }}
          className="text-primary hover:underline"
        >
          Remember my choice
        </button>
      </div>
    </div>
  );
}