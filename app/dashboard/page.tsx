"use client";

import { useAuthStore } from "@/store/authStore";
import { RoleBadge } from "@/components/layout/RoleBadge";

export default function DashboardPage() {
  const { user, userRoles, isLoading } = useAuthStore();

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
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user.name}!
        </h1>
        <div className="mt-2">
          <RoleBadge roles={userRoles} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Stats cards will go here */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Dashboard</h3>
          <p className="text-muted-foreground">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}