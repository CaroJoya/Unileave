"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollegeProfile } from "@/components/super-admin/CollegeProfile";
import { DepartmentManager } from "@/components/super-admin/DepartmentManager";
import { UserManager } from "@/components/super-admin/UserManager";
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

  // ✅ FIX: Check auth in useEffect
  useEffect(() => {
    if (!isLoading && (!user || !user.roles?.includes("super_admin"))) {
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  // ✅ FIX: Fetch departments using user.collegeId directly (no separate state)
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!user?.collegeId) return;
      
      try {
        const response = await fetch(`/api/super-admin/departments?collegeId=${user.collegeId}`);
        const data = await response.json();
        setDepartments(data.departments || []);
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };
    fetchDepartments();
  }, [user?.collegeId]); // ✅ Depends on user.collegeId directly

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Managing: {user.collegeName}
        </p>
      </div>

      <Tabs defaultValue="college" className="space-y-6">
        <TabsList>
          <TabsTrigger value="college">College Profile</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="college">
          <CollegeProfile />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentManager />
        </TabsContent>

        <TabsContent value="users">
          <UserManager departments={departments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}