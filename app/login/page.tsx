// app/login/page.tsx
"use client";

import { Suspense, lazy, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

// ✅ Lazy load the login form
const LazyLoginForm = lazy(() => 
  import("@/components/auth/LoginForm").then(mod => ({ default: mod.LoginForm }))
);

export default function LoginPage() {
  const router = useRouter();
  const { user, userRoles, isLoading, hydrationComplete } = useAuthStore();

  // ✅ Redirect if already authenticated
  useEffect(() => {
    if (!hydrationComplete || isLoading) return;
    
    if (user) {
      const roles = userRoles || user?.roles || [];
      
      // Check if account is deleted
      if (user.status === "deleted") {
        console.log("🚫 Account is deleted, staying on login page");
        return;
      }
      
      console.log("🔄 Redirecting authenticated user to dashboard, roles:", roles);
      
      // Redirect based on role
      if (roles.includes("super_admin")) {
        router.replace("/super-admin/dashboard");
      } else if (roles.includes("head_clerk")) {
        router.replace("/headclerk/dashboard");
      } else if (roles.includes("principal")) {
        router.replace("/principal/dashboard");
      } else if (roles.includes("registrar")) {
        router.replace("/registrar/dashboard");
      } else if (roles.includes("hod")) {
        router.replace("/hod/dashboard");
      } else if (roles.length > 0) {
        router.replace("/dashboard");
      } else {
        // User has no roles - stay on login page
        console.warn("⚠️ User has no roles assigned");
      }
    }
  }, [user, userRoles, isLoading, hydrationComplete, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={
        <div className="w-full max-w-md">
          <div className="animate-pulse bg-white rounded-lg shadow p-8">
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-8"></div>
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-10 bg-primary/20 rounded"></div>
            </div>
          </div>
        </div>
      }>
        <LazyLoginForm />
      </Suspense>
    </div>
  );
}