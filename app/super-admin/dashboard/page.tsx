"use client";

import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollegeProfile } from "@/components/super-admin/CollegeProfile";
import { DepartmentManager } from "@/components/super-admin/DepartmentManager";
import { UserManager } from "@/components/super-admin/UserManager";
import { SystemTools } from "@/components/super-admin/SystemTools";
import { AuditLogsContent } from "@/components/super-admin/AuditLogsContent";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RoleNavbar } from "@/components/layout/RoleNavbar";
import { Building2, Users, Database, FileText } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

// Get initial tab from URL hash
const getInitialTab = (): string => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['college', 'departments', 'users', 'audit-logs', 'system'].includes(hash)) {
      return hash;
    }
  }
  return "college";
};

function SuperAdminDashboardContent() {
  const { user, isLoading, hydrationComplete } = useAuthStore();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!hydrationComplete) return;
    if (!isLoading && (!user || !user.roles?.includes("super_admin"))) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router, hydrationComplete]);

  useEffect(() => {
    if (!hydrationComplete) return;
    if (!user?.collegeId || initialLoadDone.current) {
      if (user && !user.collegeId && !initialLoadDone.current) {
        console.log("User has no collegeId, fetching all departments");
      } else {
        return;
      }
    }

    const loadDepartments = async () => {
      setIsLoadingDepartments(true);
      try {
        let url = "/api/super-admin/departments";
        if (user?.collegeId) {
          url += `?collegeId=${user.collegeId}`;
        }
        
        console.log("Fetching departments from:", url);
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("Departments API response:", data);
        
        if (response.ok) {
          setDepartments(data.departments || []);
          console.log("Departments loaded:", data.departments?.length || 0);
          initialLoadDone.current = true;
        } else {
          console.error("Failed to fetch departments:", data.error);
          setDepartments([]);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
        setDepartments([]);
      } finally {
        setIsLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, [user, user?.collegeId, hydrationComplete]);

  const refreshDepartments = useCallback(async () => {
    const { user: currentUser } = useAuthStore.getState();
    
    try {
      toast.info("Refreshing departments...");
      let url = "/api/super-admin/departments";
      if (currentUser?.collegeId) {
        url += `?collegeId=${currentUser.collegeId}`;
      }
      
      console.log("Refreshing departments from:", url);
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setDepartments(data.departments || []);
        console.log("Departments refreshed:", data.departments?.length || 0);
        toast.success(`✅ ${data.departments?.length || 0} departments loaded`);
      } else {
        console.error("Failed to refresh departments:", data.error);
        toast.error("Failed to refresh departments");
        setDepartments([]);
      }
    } catch (error) {
      console.error("Failed to refresh departments:", error);
      toast.error("Failed to refresh departments");
      setDepartments([]);
    }
  }, []);

  const navItems = [
    { 
      label: "College Profile", 
      href: "/super-admin/dashboard", 
      icon: <Building2 className="h-4 w-4" />,
      tab: "college"
    },
    { 
      label: "Departments", 
      href: "/super-admin/dashboard", 
      icon: <Building2 className="h-4 w-4" />,
      tab: "departments"
    },
    { 
      label: "Users", 
      href: "/super-admin/dashboard", 
      icon: <Users className="h-4 w-4" />,
      tab: "users"
    },
    { 
      label: "Audit Logs", 
      href: "/super-admin/dashboard", 
      icon: <FileText className="h-4 w-4" />,
      tab: "audit-logs"
    },
    { 
      label: "System", 
      href: "/super-admin/dashboard", 
      icon: <Database className="h-4 w-4" />,
      tab: "system"
    },
  ];

  // Handle tab change with hash
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  if (!hydrationComplete || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.roles?.includes("super_admin")) {
    return null;
  }

  console.log("Dashboard - departments count:", departments.length);

  return (
    <div className="container mx-auto py-8 px-4">
      <RoleNavbar
        role="super_admin"
        navItems={navItems}
        greeting={`Welcome back, ${user?.name || "Super Admin"}! 👋`}
        subtitle={`Managing: ${user?.collegeName || "College"} • College ID: ${user?.collegeId || "Not set"}`}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 mt-6">
        <TabsList>
          <TabsTrigger value="college">College Profile</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="audit-logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="college">
          <CollegeProfile />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentManager onRefresh={refreshDepartments} />
        </TabsContent>

        <TabsContent value="users">
          <UserManager 
            departments={departments} 
            onRefresh={refreshDepartments}
            isLoading={isLoadingDepartments}
          />
        </TabsContent>

        <TabsContent value="audit-logs">
          <AuditLogsContent />
        </TabsContent>

        <TabsContent value="system">
          <SystemTools />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  return (
    <ErrorBoundary>
      <SuperAdminDashboardContent />
    </ErrorBoundary>
  );
}