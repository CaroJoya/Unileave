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
  CheckCircle,
  Ban,
  ChevronRight,
  LayoutDashboard,
  FileText,
  Building2,
  TrendingUp,
  AlertCircle,
  PieChart
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
  staffCount: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

function RegistrarDashboardContent() {
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
    if (!authLoading && user && !user.roles?.includes("registrar") && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/registrar/dashboard");
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
    if (user?.roles?.includes("registrar") && !hasFetched.current) {
      hasFetched.current = true;
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  const navItems = [
    { 
      label: "Dashboard", 
      href: "/registrar/dashboard", 
      icon: <LayoutDashboard className="h-4 w-4" /> 
    },
    { 
      label: "All Leaves", 
      href: "/registrar/all-leaves", 
      icon: <FileText className="h-4 w-4" /> 
    },
    { 
      label: "Comp Off", 
      href: "/registrar/comp-off", 
      icon: <Award className="h-4 w-4" /> 
    },
    { 
      label: "Overwork", 
      href: "/registrar/overwork", 
      icon: <Clock className="h-4 w-4" /> 
    },
    { 
      label: "Vacation", 
      href: "/registrar/vacation", 
      icon: <Umbrella className="h-4 w-4" /> 
    },
    { 
      label: "Reports", 
      href: "/registrar/reports", 
      icon: <PieChart className="h-4 w-4" /> 
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user || !user.roles?.includes("registrar")) {
    return null;
  }

  // Safe data access with defaults
  const pendingLeaves = data?.pendingLeaves ?? 0;
  const pendingCompOff = data?.pendingCompOff ?? 0;
  const pendingOverwork = data?.pendingOverwork ?? 0;
  const pendingVacation = data?.pendingVacation ?? 0;
  const staffCount = data?.staffCount ?? 0;
  const approvedThisMonth = data?.approvedThisMonth ?? 0;
  const rejectedThisMonth = data?.rejectedThisMonth ?? 0;

  const totalPending = pendingLeaves + pendingCompOff + pendingOverwork + pendingVacation;
  const totalResolved = approvedThisMonth + rejectedThisMonth;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Navbar */}
      <RoleNavbar
        role="registrar"
        navItems={navItems}
        greeting={`Welcome back, ${user?.name || "Registrar"}! 👋`}
        subtitle="Manage office staff leave requests and approvals"
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6 mb-8">
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
          label="Office Staff"
          value={staffCount}
          icon={<Users className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          label="Resolved (This Month)"
          value={totalResolved}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
          trend={{
            value: approvedThisMonth,
            label: "approved",
            direction: "up"
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
            <Link href="/registrar/all-leaves">
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
                Review All Requests
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </EnhancedCard>
      )}

      {/* Monthly Stats */}
      <SectionHeader
        title="Monthly Activity"
        subtitle={`${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`}
        icon={<TrendingUp className="h-5 w-5" />}
        className="mb-4"
      />

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <EnhancedCard 
          variant="elevated"
          accentColor="green"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <CheckCircle className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{approvedThisMonth}</p>
            <p className="text-sm text-muted-foreground">Approved This Month</p>
          </div>
        </EnhancedCard>

        <EnhancedCard 
          variant="elevated"
          accentColor="red"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <Ban className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{rejectedThisMonth}</p>
            <p className="text-sm text-muted-foreground">Rejected This Month</p>
          </div>
        </EnhancedCard>

        <EnhancedCard 
          variant="elevated"
          accentColor="primary"
          className="text-center"
        >
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{staffCount}</p>
            <p className="text-sm text-muted-foreground">Total Office Staff</p>
          </div>
        </EnhancedCard>
      </div>

      {/* Quick Actions */}
      <SectionHeader
        title="Quick Actions"
        subtitle="Common tasks for office staff management"
        icon={<Building2 className="h-5 w-5" />}
        className="mb-4"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/registrar/all-leaves" className="group">
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
              <p className="text-xs text-muted-foreground">Approve or reject office staff leaves</p>
              {pendingLeaves > 0 && (
                <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {pendingLeaves} pending
                </span>
              )}
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/registrar/reports" className="group">
          <EnhancedCard 
            variant="elevated"
            accentColor="purple"
            className="h-full hover:border-purple-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600 group-hover:bg-purple-200 transition-all duration-300 group-hover:scale-110">
                <PieChart className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Generate Reports</h4>
              <p className="text-xs text-muted-foreground">View analytics and insights</p>
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/registrar/all-leaves?view=all" className="group">
          <EnhancedCard 
            variant="elevated"
            accentColor="teal"
            className="h-full hover:border-teal-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-teal-100 text-teal-600 group-hover:bg-teal-200 transition-all duration-300 group-hover:scale-110">
                <Building2 className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">View All College Leaves</h4>
              <p className="text-xs text-muted-foreground">Complete overview of all leaves</p>
            </div>
          </EnhancedCard>
        </Link>
      </div>
    </div>
  );
}

export default function RegistrarDashboardPage() {
  return (
    <ErrorBoundary>
      <RegistrarDashboardContent />
    </ErrorBoundary>
  );
}