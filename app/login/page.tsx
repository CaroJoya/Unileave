// app/login/page.tsx
"use client";

import { Suspense, lazy } from "react";

// ✅ Lazy load the login form - removed the unused direct import
const LazyLoginForm = lazy(() => 
  import("@/components/auth/LoginForm").then(mod => ({ default: mod.LoginForm }))
);

export default function LoginPage() {
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