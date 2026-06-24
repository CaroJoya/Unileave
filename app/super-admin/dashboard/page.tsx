// app/super-admin/dashboard/page.tsx (Modified)
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollegeProfile } from "@/components/super-admin/CollegeProfile";
import { DepartmentManager } from "@/components/super-admin/DepartmentManager";
import { UserManager } from "@/components/super-admin/UserManager";
import { SystemTools } from "@/components/super-admin/SystemTools";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";

interface Department {
  id: string;
  name: string;
}

export default function SuperAdminDashboardPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const initialLoadDone = useRef(false);

  // ✅ FIX: Check auth in useEffect
  useEffect(() => {
    if (!isLoading && (!user || !user.roles?.includes("super_admin"))) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  // ✅ FIXED: Load departments when user becomes available
  useEffect(() => {
    if (!user?.collegeId || initialLoadDone.current) {
      // If no collegeId but we have user, try without collegeId
      if (user && !user.collegeId && !initialLoadDone.current) {
        console.log("User has no collegeId, fetching all departments");
      } else {
        return;
      }
    }

    const loadDepartments = async () => {
      setIsLoadingDepartments(true);
      try {
        // ✅ Try with collegeId first, fallback to no filter
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
  }, [user, user?.collegeId]); // ✅ Depend on user and collegeId

  // ✅ Refresh function
  const refreshDepartments = useCallback(async () => {
    const { user: currentUser } = useAuthStore.getState();
    
    try {
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
      } else {
        console.error("Failed to refresh departments:", data.error);
        setDepartments([]);
      }
    } catch (error) {
      console.error("Failed to refresh departments:", error);
      setDepartments([]);
    }
  }, []);

  if (isLoading) {
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Managing: {user.collegeName || "College"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          College ID: {user.collegeId || "Not set"}
        </p>
      </div>

      <Tabs defaultValue="college" className="space-y-6">
        <TabsList>
          <TabsTrigger value="college">College Profile</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
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

        <TabsContent value="system">
          <SystemTools />
        </TabsContent>
      </Tabs>
    </div>
  );
}