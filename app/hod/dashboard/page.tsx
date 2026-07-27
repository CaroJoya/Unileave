"use client";

import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  Award, 
  Clock, 
  Umbrella,
  Users,
  ChevronRight,
  LayoutDashboard,
  FileText,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { RoleNavbar } from "@/components/layout/RoleNavbar";
import { EnhancedCard } from "@/components/ui/enhanced-card";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";
interface DashboardData {
  pendingLeaves: number;
  pendingCompOff: number;
  pendingOverwork: number;
  pendingVacation: number;
  facultyCount: number;
}

function HODDashboardContent() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const hasRedirected = useRef(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!authLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/login");
    }
    if (!authLoading && user && !user.roles?.includes("hod") && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hod/dashboard");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch dashboard data");
      }

      setData(result);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.roles?.includes("hod") && !hasFetched.current) {
      hasFetched.current = true;
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  const navItems = [
    { 
      label: "Dashboard", 
      href: "/hod/dashboard", 
      icon: <LayoutDashboard className="h-4 w-4" /> 
    },
    { 
      label: "Faculty Requests", 
      href: "/hod/faculty-requests", 
      icon: <Users className="h-4 w-4" /> 
    },
    { 
      label: "Comp Off", 
      href: "/hod/comp-off", 
      icon: <Award className="h-4 w-4" /> 
    },
    { 
      label: "Overwork", 
      href: "/hod/overwork", 
      icon: <Clock className="h-4 w-4" /> 
    },
    { 
      label: "Vacation", 
      href: "/hod/vacation", 
      icon: <Umbrella className="h-4 w-4" /> 
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user || !user.roles?.includes("hod")) {
    return null;
  }

  // Safe data access with defaults
  const pendingLeaves = data?.pendingLeaves ?? 0;
  const pendingCompOff = data?.pendingCompOff ?? 0;
  const pendingOverwork = data?.pendingOverwork ?? 0;
  const pendingVacation = data?.pendingVacation ?? 0;
  const facultyCount = data?.facultyCount ?? 0;

  const totalPending = pendingLeaves + pendingCompOff + pendingOverwork + pendingVacation;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Navbar */}
      <RoleNavbar
        role="hod"
        navItems={navItems}
        greeting={`Welcome back, ${user?.name || "HOD"}! 👋`}
        subtitle={`Department: ${user?.departmentName || "Not assigned"}`}
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mt-6 mb-8">
        <StatCard
          label="Pending Leave Requests"
          value={pendingLeaves}
          icon={<CalendarDays className="h-5 w-5" />}
          color="blue"
          trend={{
            value: pendingLeaves,
            label: "needs review",
            direction: pendingLeaves > 0 ? "down" : "neutral"
          }}
        />
        <StatCard
          label="Pending Comp Off"
          value={pendingCompOff}
          icon={<Award className="h-5 w-5" />}
          color="teal"
        />
        <StatCard
          label="Pending Overwork"
          value={pendingOverwork}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          label="Pending Vacation"
          value={pendingVacation}
          icon={<Umbrella className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          label="Department Faculty"
          value={facultyCount}
          icon={<Users className="h-5 w-5" />}
          color="primary"
        />
      </div>

      {/* Total Pending Alert */}
      {totalPending > 0 && (
        <EnhancedCard 
          variant="elevated" 
          accentColor="amber"
          className="mb-8 border-amber-200/50"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-800">⚠️ Pending Requests</h4>
                <p className="text-sm text-amber-600">
                  You have {totalPending} pending request(s) requiring your attention
                </p>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pendingLeaves > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-blue-700">{pendingLeaves}</p>
                <p className="text-xs text-blue-600">Leave Requests</p>
              </div>
            )}
            {pendingCompOff > 0 && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-teal-700">{pendingCompOff}</p>
                <p className="text-xs text-teal-600">Comp Off</p>
              </div>
            )}
            {pendingOverwork > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-yellow-700">{pendingOverwork}</p>
                <p className="text-xs text-yellow-600">Overwork</p>
              </div>
            )}
            {pendingVacation > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-purple-700">{pendingVacation}</p>
                <p className="text-xs text-purple-600">Vacation</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <Link href="/hod/faculty-requests">
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                Review All Requests
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </EnhancedCard>
      )}

      {/* Quick Actions */}
      <SectionHeader
        title="Quick Actions"
        subtitle="Common tasks for department management"
        icon={<TrendingUp className="h-5 w-5" />}
        className="mb-4"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Link href="/hod/faculty-requests" className="group">
          <EnhancedCard 
            variant="elevated"
            accentColor="blue"
            className="h-full hover:border-blue-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-all duration-300 group-hover:scale-110">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Review Leave Requests</h4>
              <p className="text-xs text-muted-foreground">Approve or reject faculty leaves</p>
              {pendingLeaves > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {pendingLeaves} pending
                </span>
              )}
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/hod/comp-off" className="group">
          <EnhancedCard 
            variant="elevated"
            accentColor="teal"
            className="h-full hover:border-teal-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-teal-100 text-teal-600 group-hover:bg-teal-200 transition-all duration-300 group-hover:scale-110">
                <Award className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Review Comp Off</h4>
              <p className="text-xs text-muted-foreground">Approve or reject comp-off requests</p>
              {pendingCompOff > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                  {pendingCompOff} pending
                </span>
              )}
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/hod/overwork" className="group">
          <EnhancedCard 
            variant="elevated"
            accentColor="amber"
            className="h-full hover:border-amber-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-all duration-300 group-hover:scale-110">
                <Clock className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Review Overwork</h4>
              <p className="text-xs text-muted-foreground">Approve or reject overwork entries</p>
              {pendingOverwork > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  {pendingOverwork} pending
                </span>
              )}
            </div>
          </EnhancedCard>
        </Link>
      </div>

      {/* Department Stats */}
      <SectionHeader
        title="Department Overview"
        subtitle={`${facultyCount} faculty members in your department`}
        icon={<Users className="h-5 w-5" />}
        className="mb-4"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <EnhancedCard 
          variant="elevated"
          accentColor="blue"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-blue-600 mb-2">
              <CalendarDays className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{pendingLeaves}</p>
            <p className="text-sm text-muted-foreground">Pending Leaves</p>
          </div>
        </EnhancedCard>

        <EnhancedCard 
          variant="elevated"
          accentColor="teal"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-teal-600 mb-2">
              <Award className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{pendingCompOff}</p>
            <p className="text-sm text-muted-foreground">Pending Comp Off</p>
          </div>
        </EnhancedCard>

        <EnhancedCard 
          variant="elevated"
          accentColor="amber"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
              <Clock className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{pendingOverwork}</p>
            <p className="text-sm text-muted-foreground">Pending Overwork</p>
          </div>
        </EnhancedCard>

        <EnhancedCard 
          variant="elevated"
          accentColor="purple"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-purple-600 mb-2">
              <Umbrella className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{pendingVacation}</p>
            <p className="text-sm text-muted-foreground">Pending Vacation</p>
          </div>
        </EnhancedCard>
      </div>
    </div>
  );
}

export default function HODDashboardPage() {
  return (
    <ErrorBoundary>
      <HODDashboardContent />
    </ErrorBoundary>
  );
}