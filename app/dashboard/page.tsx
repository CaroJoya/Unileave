"use client";

import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function DashboardPage() {
  const { user, userRoles, isLoading } = useAuthStore();
  const router = useRouter();
  const hasRedirected = useRef(false);

  // ✅ ROLE-BASED REDIRECTION - Redirect users to their specific dashboards
  useEffect(() => {
    if (!isLoading && user && !hasRedirected.current) {
      hasRedirected.current = true;
      
      // Redirect to role-specific dashboard
      if (userRoles.includes("super_admin")) {
        router.push("/super-admin/dashboard");
      } else if (userRoles.includes("head_clerk")) {
        router.push("/headclerk/dashboard");
      } else if (userRoles.includes("hod")) {
        router.push("/hod/dashboard");
      } else if (userRoles.includes("registrar")) {
        router.push("/registrar/dashboard");
      } else if (userRoles.includes("principal")) {
        router.push("/principal/dashboard");
      }
      // If no specific role, stay on this page
    }
    
    // Redirect to login if not authenticated
    if (!isLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/login");
    }
  }, [user, userRoles, isLoading, router]);

  // Show loading while checking auth
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

  if (!user) {
    return null; // Will redirect via useEffect
  }

  // Fallback dashboard (if no specific role matched)
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user.name}!
        </h1>
        <p className="text-muted-foreground mt-2">
          General Dashboard - Please contact admin if you need access to specific features.
        </p>
      </div>
    </div>
  );
}