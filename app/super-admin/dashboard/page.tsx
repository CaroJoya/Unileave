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
import { Building2, Users, FileText, Shield, Activity, Settings } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

interface Department {
  id: string;
  name: string;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  status: string;
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
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const initialLoadDone = useRef(false);

  // Auth check
  useEffect(() => {
    if (!hydrationComplete) return;
    if (!isLoading && (!user || !user.roles?.includes("super_admin"))) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router, hydrationComplete]);

  // Fetch departments
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

  // Fetch users for stats
  useEffect(() => {
    if (!hydrationComplete || !user?.collegeId) return;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch("/api/super-admin/users");
        const data = await response.json();
        if (response.ok) {
          setUsers(data.users || []);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadUsers();
  }, [user, hydrationComplete]);

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
      icon: <Settings className="h-4 w-4" />,
      tab: "system"
    },
  ];

  // Handle tab change with hash
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Calculate stats
  const activeUsers = users.filter(u => u.status === "active").length;
  const deletedUsers = users.filter(u => u.status === "deleted").length;
  const totalDepartments = departments.length;

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
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Navbar */}
      <RoleNavbar
        role="super_admin"
        navItems={navItems}
        greeting={`Welcome back, ${user?.name || "Super Admin"}! 👋`}
        subtitle={`Managing: ${user?.collegeName || "College"} • College ID: ${user?.collegeId || "Not set"}`}
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6 mb-8">
        <StatCard
          label="Total Departments"
          value={totalDepartments}
          icon={<Building2 className="h-5 w-5" />}
          color="primary"
          trend={{
            value: totalDepartments,
            label: "departments",
            direction: "neutral"
          }}
        />
        <StatCard
          label="Active Users"
          value={activeUsers}
          icon={<Users className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="Deactivated Users"
          value={deletedUsers}
          icon={<Shield className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          label="System Status"
          value="Online"
          icon={<Activity className="h-5 w-5" />}
          color="teal"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger 
            value="college" 
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 gap-2"
          >
            <Building2 className="h-4 w-4" />
            College Profile
          </TabsTrigger>
          <TabsTrigger 
            value="departments" 
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 gap-2"
          >
            <Building2 className="h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 gap-2"
          >
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger 
            value="audit-logs" 
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 gap-2"
          >
            <FileText className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger 
            value="system" 
            className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200 gap-2"
          >
            <Settings className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="college" className="mt-0">
          <CollegeProfile />
        </TabsContent>

        <TabsContent value="departments" className="mt-0">
          <DepartmentManager onRefresh={refreshDepartments} />
        </TabsContent>

        <TabsContent value="users" className="mt-0">
          <UserManager 
            departments={departments} 
            onRefresh={refreshDepartments}
            isLoading={isLoadingDepartments || isLoadingUsers}
          />
        </TabsContent>

        <TabsContent value="audit-logs" className="mt-0">
          <AuditLogsContent />
        </TabsContent>

        <TabsContent value="system" className="mt-0">
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