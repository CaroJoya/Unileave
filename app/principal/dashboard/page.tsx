// app/principal/dashboard/page.tsx - COMPLETE FIXED VERSION
"use client";

import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  Clock, 
  Award, 
  Umbrella,
  AlertTriangle,
  ChevronRight,
  LayoutDashboard,
  Shield,
  FileText
} from "lucide-react";
import Link from "next/link";
import { RoleNavbar } from "@/components/layout/RoleNavbar";
import { EnhancedCard } from "@/components/ui/enhanced-card";
import { StatCard } from "@/components/ui/stat-card";
import { SectionHeader } from "@/components/ui/section-header";

interface DashboardData {
  pendingApprovals: number;
  pendingOverwork: number;
  pendingCompOff: number;
  pendingVacation: number;
  overrideEligible: number;
}

function PrincipalDashboardContent() {
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
    if (!authLoading && user && !user.roles?.includes("principal") && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/principal/dashboard");
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
    if (user?.roles?.includes("principal") && !hasFetched.current) {
      hasFetched.current = true;
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  const navItems = [
    { 
      label: "Dashboard", 
      href: "/principal/dashboard", 
      icon: <LayoutDashboard className="h-4 w-4" /> 
    },
    { 
      label: "Direct Approvals", 
      href: "/principal/direct-approvals", 
      icon: <CalendarDays className="h-4 w-4" /> 
    },
    { 
      label: "Override Eligible", 
      href: "/principal/override-eligible", 
      icon: <AlertTriangle className="h-4 w-4" /> 
    },
    { 
      label: "Comp Off", 
      href: "/principal/comp-off", 
      icon: <Award className="h-4 w-4" /> 
    },
    { 
      label: "Overwork", 
      href: "/principal/overwork", 
      icon: <Clock className="h-4 w-4" /> 
    },
    { 
      label: "Vacation", 
      href: "/principal/vacation", 
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

  if (!user || !user.roles?.includes("principal")) {
    return null;
  }

  // Safe data access with defaults
  const pendingApprovals = data?.pendingApprovals ?? 0;
  const pendingOverwork = data?.pendingOverwork ?? 0;
  const pendingCompOff = data?.pendingCompOff ?? 0;
  const pendingVacation = data?.pendingVacation ?? 0;
  const overrideEligible = data?.overrideEligible ?? 0;

  const totalPending = pendingApprovals + pendingOverwork + pendingCompOff + pendingVacation;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Navbar */}
      <RoleNavbar
        role="principal"
        navItems={navItems}
        greeting={`Welcome back, ${user?.name || "Principal"}! 👋`}
        subtitle={`College: ${user?.collegeName || "Not assigned"}`}
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mt-6 mb-8">
        <StatCard
          label="Pending Direct Approvals"
          value={pendingApprovals}
          icon={<CalendarDays className="h-5 w-5" />}
          color="blue"
          trend={{
            value: pendingApprovals,
            label: "needs review",
            direction: pendingApprovals > 0 ? "down" : "neutral"
          }}
        />
        <StatCard
          label="Pending Overwork"
          value={pendingOverwork}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          label="Pending Comp Off"
          value={pendingCompOff}
          icon={<Award className="h-5 w-5" />}
          color="teal"
        />
        <StatCard
          label="Pending Vacation"
          value={pendingVacation}
          icon={<Umbrella className="h-5 w-5" />}
          color="purple"
        />
        <StatCard
          label="Override Eligible"
          value={overrideEligible}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="red"
          trend={{
            value: overrideEligible,
            label: "can be overridden",
            direction: overrideEligible > 0 ? "down" : "neutral"
          }}
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
                <AlertTriangle className="h-5 w-5" />
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
            {pendingApprovals > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-blue-700">{pendingApprovals}</p>
                <p className="text-xs text-blue-600">Direct Approvals</p>
              </div>
            )}
            {pendingOverwork > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-amber-700">{pendingOverwork}</p>
                <p className="text-xs text-amber-600">Overwork</p>
              </div>
            )}
            {pendingCompOff > 0 && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-teal-700">{pendingCompOff}</p>
                <p className="text-xs text-teal-600">Comp Off</p>
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
            <Link href="/principal/direct-approvals">
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                Review All Requests
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </EnhancedCard>
      )}

      {/* Override Eligible Alert */}
      {overrideEligible > 0 && (
        <EnhancedCard 
          variant="elevated" 
          accentColor="red"
          className="mb-8 border-red-200/50"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-red-800">🔴 Override Eligible</h4>
                <p className="text-sm text-red-600">
                  {overrideEligible} approved leave request(s) can be overridden
                </p>
              </div>
              <div className="ml-auto">
                <Link href="/principal/override-eligible">
                  <Button size="sm" variant="destructive" className="gap-2">
                    View Eligible
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          }
        >
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              <strong>Note:</strong> Overriding an approved request will restore the employee&apos;s leave balance.
              This action cannot be undone.
            </p>
          </div>
        </EnhancedCard>
      )}

      {/* Quick Actions */}
      <SectionHeader
        title="Quick Actions"
        subtitle="Common tasks for principal oversight"
        icon={<Shield className="h-5 w-5" />}
        className="mb-4"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Link href="/principal/direct-approvals" className="group">
          <EnhancedCard 
            variant="elevated"
            accentColor="blue"
            className="h-full hover:border-blue-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-all duration-300 group-hover:scale-110">
                <FileText className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Review Direct Approvals</h4>
              <p className="text-xs text-muted-foreground">Approve or reject requests from HODs &amp; Registrars</p>
              {pendingApprovals > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {pendingApprovals} pending
                </span>
              )}
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/principal/override-eligible" className="group">
          <EnhancedCard 
            variant="elevated"
            accentColor="red"
            className="h-full hover:border-red-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-red-100 text-red-600 group-hover:bg-red-200 transition-all duration-300 group-hover:scale-110">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Review Override Eligible</h4>
              <p className="text-xs text-muted-foreground">Override approved leave requests</p>
              {overrideEligible > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {overrideEligible} eligible
                </span>
              )}
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/principal/overwork" className="group">
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

      {/* College Stats */}
      <SectionHeader
        title="College Overview"
        subtitle="Summary of all pending requests across the college"
        icon={<Shield className="h-5 w-5" />}
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
            <p className="text-2xl font-bold text-gray-900">{pendingApprovals}</p>
            <p className="text-sm text-muted-foreground">Pending Approvals</p>
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
          accentColor="red"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{overrideEligible}</p>
            <p className="text-sm text-muted-foreground">Override Eligible</p>
          </div>
        </EnhancedCard>
      </div>
    </div>
  );
}

export default function PrincipalDashboardPage() {
  return (
    <ErrorBoundary>
      <PrincipalDashboardContent />
    </ErrorBoundary>
  );
}