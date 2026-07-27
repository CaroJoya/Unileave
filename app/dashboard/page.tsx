// app/dashboard/page.tsx - Fixed duplicate imports
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { useEffect, useCallback } from "react";
import Link from "next/link";
import { Role } from "@/types/roles";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useRoleStore } from "@/store/roleStore";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  FilePlus2,
  ListChecks,
  BarChart3,
  Award,
  Clock,
  Umbrella,
  TrendingUp,
  ChevronRight,
  CheckCircle,
  LayoutDashboard,
  RefreshCw,
  AlertTriangle,
  Users,
  Activity,
} from "lucide-react";
import { RoleNavbar } from "@/components/layout/RoleNavbar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { EnhancedCard } from "@/components/ui/enhanced-card";

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface CompOffCredit {
  id: string;
  creditedDays: number;
  usedDays: number;
  status: string;
  expiryDate: string;
}

// Standard leaves to include in Total Calculation
const STANDARD_LEAVE_TYPES = ["CL", "EL", "ML", "CO"];

// Fetch functions for React Query
const fetchBalances = async () => {
  const res = await fetch("/api/leave/balances", {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) throw new Error("Failed to fetch balances");
  return res.json();
};

const fetchRequests = async () => {
  const res = await fetch("/api/leave/my-requests", {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) throw new Error("Failed to fetch requests");
  return res.json();
};

const fetchCompOff = async () => {
  const res = await fetch("/api/comp-off/credits", {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) throw new Error("Failed to fetch comp-off");
  return res.json();
};

const fetchOverwork = async () => {
  const res = await fetch("/api/overwork/my-summary", {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) throw new Error("Failed to fetch overwork");
  return res.json();
};

function DashboardContent() {
  const { user, userRoles, isLoading: authLoading, hydrationComplete } = useAuthStore();
  const { currentRole } = useRoleStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  // React Query for all data - with proper refetch on focus
  const {
    data: balanceData,
    isLoading: balancesLoading,
    refetch: refetchBalances
  } = useQuery({
    queryKey: ['balances', user?.uid],
    queryFn: fetchBalances,
    enabled: !!user?.uid && !user?.roles?.includes("principal"),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const {
    data: requestsData,
    isLoading: requestsLoading,
    refetch: refetchRequests
  } = useQuery({
    queryKey: ['requests', user?.uid],
    queryFn: fetchRequests,
    enabled: !!user?.uid && !user?.roles?.includes("principal"),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const {
    data: compOffData,
    isLoading: compOffLoading,
    refetch: refetchCompOff
  } = useQuery({
    queryKey: ['compOff', user?.uid],
    queryFn: fetchCompOff,
    enabled: !!user?.uid && !user?.roles?.includes("principal"),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const {
    data: overworkData,
    isLoading: overworkLoading,
    refetch: refetchOverwork
  } = useQuery({
    queryKey: ['overwork', user?.uid],
    queryFn: fetchOverwork,
    enabled: !!user?.uid && !user?.roles?.includes("principal"),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // FORCE REFETCH WHEN TAB BECOMES VISIBLE
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Tab became visible - Refetching balances...');
        refetchBalances();
        refetchRequests();
        refetchCompOff();
        refetchOverwork();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchBalances, refetchRequests, refetchCompOff, refetchOverwork]);

  // FORCE REFETCH ON FOCUS
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Window focused - Refetching balances...');
      refetchBalances();
      refetchRequests();
      refetchCompOff();
      refetchOverwork();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchBalances, refetchRequests, refetchCompOff, refetchOverwork]);

  // Derived state with proper calculations
  const dashboardData = (() => {
    const balances = balanceData?.balances || {};
    const requests = requestsData?.requests || [];

    // Calculate totals using STANDARD_LEAVE_TYPES only
    let totalAllocated = 0;
    let totalUsed = 0;
    let totalAvailable = 0;

    Object.entries(balances).forEach(([type, balance]) => {
      const b = balance as LeaveBalance;
      if (STANDARD_LEAVE_TYPES.includes(type)) {
        totalAllocated += (b?.allocated || 0);
        totalUsed += (b?.used || 0);
        totalAvailable += (b?.available || 0);
      }
    });

    const utilization = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;

    const pendingRequests = requests.filter(
      (req: { status: string }) =>
        req.status === "Pending_HOD" ||
        req.status === "Pending_Registrar" ||
        req.status === "Pending_Principal"
    ).length;

    const revisionRequests = requests.filter(
      (req: { status: string }) =>
        req.status === "Pending_Revision"
    ).length;

    const approvedRequests = requests.filter(
      (req: { status: string }) => req.status === "Approved"
    ).length;

    const rejectedRequests = requests.filter(
      (req: { status: string }) =>
        req.status === "Rejected_HOD" ||
        req.status === "Rejected_Registrar" ||
        req.status === "Rejected_Principal"
    ).length;

    // Comp-off balance
    const credits = compOffData?.credits || [];
    const compOffBalance = credits
      .filter((c: CompOffCredit) => c.status === 'active')
      .reduce((sum: number, c: CompOffCredit) => sum + (c.creditedDays - c.usedDays), 0);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringCompOffCredits = credits.filter((c: CompOffCredit) => {
      if (c.status !== 'active') return false;
      const expiryDate = new Date(c.expiryDate);
      return expiryDate <= thirtyDaysFromNow && expiryDate > now;
    });

    const overworkSummary = overworkData?.summary || {
      totalApprovedHours: 0,
      pendingHours: 0,
      earnedLeaves: 0,
      progressPercent: 0,
    };

    return {
      balances,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      revisionRequests,
      totalAvailable,
      totalAllocated,
      totalUsed,
      utilization,
      compOffBalance,
      compOffCredits: credits,
      expiringCompOffCredits,
      overworkSummary,
    };
  })();

  // Manual refresh function that invalidates all queries
  const refreshAllData = useCallback(async () => {
    console.log('🔄 Manual refresh triggered...');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['balances'] }),
      queryClient.invalidateQueries({ queryKey: ['requests'] }),
      queryClient.invalidateQueries({ queryKey: ['compOff'] }),
      queryClient.invalidateQueries({ queryKey: ['overwork'] }),
    ]);
    await Promise.all([
      refetchBalances(),
      refetchRequests(),
      refetchCompOff(),
      refetchOverwork(),
    ]);
    console.log('✅ Manual refresh complete');
  }, [queryClient, refetchBalances, refetchRequests, refetchCompOff, refetchOverwork]);

  // Auth check
  useEffect(() => {
    if (!hydrationComplete) return;
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user) {
      const staffRoles = ["faculty", "lab_assistant", "office_staff"];
      const adminRoles = ["super_admin", "head_clerk", "hod", "registrar", "principal"];
      const hasStaff = userRoles.some((r) => staffRoles.includes(r));
      const hasAdmin = userRoles.some((r) => adminRoles.includes(r));

      if (hasStaff && hasAdmin && !currentRole) {
        router.push("/select-role");
        return;
      }

      if (!hasStaff && hasAdmin) {
        if (userRoles.includes("super_admin")) {
          router.push("/super-admin/dashboard");
          return;
        }
        if (userRoles.includes("head_clerk")) {
          router.push("/headclerk/dashboard");
          return;
        }
        if (userRoles.includes("hod")) {
          router.push("/hod/dashboard");
          return;
        }
        if (userRoles.includes("registrar")) {
          router.push("/registrar/dashboard");
          return;
        }
        if (userRoles.includes("principal")) {
          router.push("/principal/dashboard");
          return;
        }
      }
    }
  }, [user, userRoles, authLoading, router, currentRole, hydrationComplete]);

  const isLoading = authLoading || balancesLoading || requestsLoading || compOffLoading || overworkLoading;

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

  if (!user) return null;

  const getRoleLabel = () => {
    if (userRoles.includes("faculty")) return "Faculty";
    if (userRoles.includes("lab_assistant")) return "Lab Assistant";
    if (userRoles.includes("office_staff")) return "Office Staff";
    return "Staff";
  };

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />
    },
    {
      label: "Request Leave",
      href: "/request-leave",
      icon: <FilePlus2 className="h-4 w-4" />
    },
    {
      label: "My Status",
      href: "/status",
      icon: <ListChecks className="h-4 w-4" />
    },
    {
      label: "My Stats",
      href: "/stats",
      icon: <BarChart3 className="h-4 w-4" />
    },
    {
      label: "Vacation",
      href: "/vacation",
      icon: <Umbrella className="h-4 w-4" />
    },
    {
      label: "Comp Off",
      href: "/comp-off",
      icon: <Award className="h-4 w-4" />
    },
    {
      label: "Overwork",
      href: "/overwork",
      icon: <Clock className="h-4 w-4" />
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Navbar */}
      <RoleNavbar
        role={userRoles[0] as Role || "faculty"}
        navItems={navItems}
        greeting={`Welcome back, ${user.name}! 👋`}
        subtitle={`${user.departmentName} • ${getRoleLabel()}`}
      />

      {/* Refresh Button */}
      <div className="flex justify-end mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshAllData()}
          disabled={isLoading}
          className="gap-2 hover:bg-primary/5 transition-all duration-300"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing...' : 'Refresh All'}
        </Button>
      </div>

      {/* ========== STATS CARDS ========== */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Total Balance Card */}
        <StatCard
          label="Total Leave Balance"
          value={dashboardData.totalAvailable?.toFixed(1) || 0}
          icon={<CalendarDays className="h-5 w-5" />}
          color="primary"
          trend={{
            value: dashboardData.utilization ? Math.round(dashboardData.utilization) : 0,
            label: "Utilization",
            direction: dashboardData.utilization > 80 ? "neutral" : "up"
          }}
        />

        {/* Comp-Off Balance Card */}
        <StatCard
          label="Comp-Off Balance"
          value={dashboardData.compOffBalance?.toFixed(1) || 0}
          icon={<Award className="h-5 w-5" />}
          color="teal"
          trend={{
            value: dashboardData.expiringCompOffCredits.length || 0,
            label: "expiring soon",
            direction: dashboardData.expiringCompOffCredits.length > 0 ? "down" : "neutral"
          }}
        />

        {/* Pending Approval Card */}
        <StatCard
          label="Pending Approval"
          value={dashboardData.pendingRequests || 0}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
          trend={{
            value: dashboardData.revisionRequests || 0,
            label: "needs revision",
            direction: dashboardData.revisionRequests > 0 ? "down" : "neutral"
          }}
        />

        {/* Approved Card */}
        <StatCard
          label="Approved"
          value={dashboardData.approvedRequests || 0}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* ========== REVISION REQUESTS ALERT ========== */}
      {dashboardData.revisionRequests > 0 && (
        <EnhancedCard
          variant="elevated"
          accentColor="purple"
          className="mb-6 border-purple-200/50"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-purple-800">Needs Revision</h4>
                <p className="text-sm text-purple-600">
                  {dashboardData.revisionRequests} request(s) require your attention
                </p>
              </div>
            </div>
          }
          footer={
            <div className="flex justify-end">
              <Link href="/status">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-all duration-300"
                >
                  Review Revision Requests
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          }
        >
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(dashboardData.revisionRequests * 20, 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-purple-700">
              {dashboardData.revisionRequests} pending
            </span>
          </div>
        </EnhancedCard>
      )}

      {/* ========== QUICK ACTIONS ========== */}
      <SectionHeader
        title="Quick Actions"
        subtitle="Common tasks at your fingertips"
        icon={<Activity className="h-5 w-5" />}
        className="mb-4"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Request Leave */}
        <Link href="/request-leave" className="group">
          <EnhancedCard
            variant="elevated"
            accentColor="primary"
            className="h-full hover:border-primary/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                <FilePlus2 className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Request Leave</h4>
              <p className="text-xs text-muted-foreground">Submit new leave request</p>
              <div className="mt-2 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Click to start →
              </div>
            </div>
          </EnhancedCard>
        </Link>

        {/* My Status */}
        <Link href="/status" className="group">
          <EnhancedCard
            variant="elevated"
            accentColor="blue"
            className="h-full hover:border-blue-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-all duration-300 group-hover:scale-110">
                <ListChecks className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">My Status</h4>
              <p className="text-xs text-muted-foreground">Track your requests</p>
              <div className="mt-2 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View all →
              </div>
            </div>
          </EnhancedCard>
        </Link>

        {/* My Stats */}
        <Link href="/stats" className="group">
          <EnhancedCard
            variant="elevated"
            accentColor="purple"
            className="h-full hover:border-purple-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600 group-hover:bg-purple-200 transition-all duration-300 group-hover:scale-110">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">My Stats</h4>
              <p className="text-xs text-muted-foreground">View analytics</p>
              <div className="mt-2 text-xs text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                See insights →
              </div>
            </div>
          </EnhancedCard>
        </Link>

        {/* Comp Off */}
        <Link href="/comp-off" className="group">
          <EnhancedCard
            variant="elevated"
            accentColor="teal"
            className="h-full hover:border-teal-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex flex-col items-center text-center py-4">
              <div className="p-3 rounded-full bg-teal-100 text-teal-600 group-hover:bg-teal-200 transition-all duration-300 group-hover:scale-110">
                <Award className="h-6 w-6" />
              </div>
              <h4 className="font-semibold mt-3 text-gray-900">Comp Off</h4>
              <p className="text-xs text-muted-foreground">Manage comp-off credits</p>
              <div className="mt-2 text-xs text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View credits →
              </div>
            </div>
          </EnhancedCard>
        </Link>
      </div>

      {/* ========== DETAILED SECTIONS ========== */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Leave Balance Details */}
        <EnhancedCard
          variant="elevated"
          accentColor="primary"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Leave Balance Details</h3>
                <p className="text-sm text-muted-foreground">Your current leave balances</p>
              </div>
            </div>
          }
        >
          {dashboardData.balances && Object.keys(dashboardData.balances).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(dashboardData.balances).map(([type, balance]) => {
                const b = balance as LeaveBalance;
                const available = b?.available ?? 0;
                const allocated = b?.allocated ?? 0;
                const used = b?.used ?? 0;
                const pending = b?.pending ?? 0;
                const usedPercent = allocated > 0 ? (used / allocated) * 100 : 0;

                return (
                  <div key={type} className="group">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{type}</span>
                      <span className="text-gray-600">
                        {available.toFixed(1)} / {allocated.toFixed(1)} days
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 group-hover:from-primary/80 group-hover:to-primary"
                        style={{
                          width: `${Math.min(usedPercent, 100)}%`,
                        }}
                      />
                    </div>
                    {pending > 0 && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {pending} day(s) pending approval
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No leave balances available</p>
          )}
        </EnhancedCard>

        {/* Overwork Summary */}
        <EnhancedCard
          variant="elevated"
          accentColor="amber"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Overwork Summary</h3>
                <p className="text-sm text-muted-foreground">Your overwork hours and earned leave</p>
              </div>
            </div>
          }
        >
          {dashboardData.overworkSummary ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 hover:border-primary/20 transition-all duration-300">
                  <p className="text-sm text-muted-foreground">Approved Hours</p>
                  <p className="text-2xl font-bold text-primary">
                    {dashboardData.overworkSummary.totalApprovedHours?.toFixed(1) || 0}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 hover:border-green-200 transition-all duration-300">
                  <p className="text-sm text-muted-foreground">Earned Leaves</p>
                  <p className="text-2xl font-bold text-green-600">
                    {dashboardData.overworkSummary.earnedLeaves || 0}
                  </p>
                </div>
              </div>

              {dashboardData.overworkSummary.pendingHours > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    {dashboardData.overworkSummary.pendingHours.toFixed(1)} hours pending approval
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress to next leave day</span>
                  <span className="font-medium">{dashboardData.overworkSummary.progressPercent?.toFixed(0) || 0}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${dashboardData.overworkSummary.progressPercent || 0}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {5 - (dashboardData.overworkSummary.totalApprovedHours % 5)} hours to next leave
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2 hover:bg-amber-50 hover:border-amber-300 transition-all duration-300"
                onClick={() => router.push("/overwork")}
              >
                <TrendingUp className="h-4 w-4" />
                Manage Overwork
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No overwork data available</p>
          )}
        </EnhancedCard>
      </div>

      {/* ========== OTHER RESOURCES ========== */}
      <SectionHeader
        title="Other Resources"
        subtitle="Additional tools and features"
        icon={<Users className="h-5 w-5" />}
        className="mt-8 mb-4"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/comp-off" className="group">
          <EnhancedCard
            variant="elevated"
            accentColor="teal"
            className="hover:border-teal-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-4 p-2">
              <div className="p-2 rounded-lg bg-teal-100 text-teal-600 group-hover:bg-teal-200 transition-all duration-300">
                <Award className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Comp Off</p>
                <p className="text-xs text-muted-foreground">View and use comp off credits</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/overwork" className="group">
          <EnhancedCard
            variant="elevated"
            accentColor="amber"
            className="hover:border-amber-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-4 p-2">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-all duration-300">
                <Clock className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Overwork</p>
                <p className="text-xs text-muted-foreground">Track extra hours worked</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
          </EnhancedCard>
        </Link>

        <Link href="/vacation" className="group">
          <EnhancedCard
            variant="elevated"
            accentColor="blue"
            className="hover:border-blue-300/30 group-hover:shadow-xl transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-4 p-2">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-all duration-300">
                <Umbrella className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Vacation</p>
                <p className="text-xs text-muted-foreground">Apply for vacation leave</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all duration-300" />
            </div>
          </EnhancedCard>
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}