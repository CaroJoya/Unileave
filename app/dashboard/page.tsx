// app/dashboard/page.tsx - COMPLETE UPDATED VERSION
"use client";

import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Role } from "@/types/roles";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useRoleStore } from "@/store/roleStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  XCircle,
  LayoutDashboard,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { RoleNavbar } from "@/components/layout/RoleNavbar";

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

interface DashboardData {
  balances: Record<string, LeaveBalance>;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  revisionRequests: number;
  totalAvailable: number;
  totalAllocated: number;
  totalUsed: number;
  utilization: number;
  compOffBalance: number;
  compOffCredits: CompOffCredit[];
  expiringCompOffCredits: CompOffCredit[];
  overworkSummary: {
    totalApprovedHours: number;
    pendingHours: number;
    earnedLeaves: number;
    progressPercent: number;
  };
}

function DashboardContent() {
  const { user, userRoles, isLoading: authLoading, hydrationComplete } = useAuthStore();
  const { currentRole } = useRoleStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    balances: {},
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    revisionRequests: 0,
    totalAvailable: 0,
    totalAllocated: 0,
    totalUsed: 0,
    utilization: 0,
    compOffBalance: 0,
    compOffCredits: [],
    expiringCompOffCredits: [],
    overworkSummary: {
      totalApprovedHours: 0,
      pendingHours: 0,
      earnedLeaves: 0,
      progressPercent: 0,
    },
  });

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

  const refreshBalance = useCallback(async () => {
    try {
      const balanceRes = await fetch("/api/leave/balances", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      });
      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        const balances = balanceData.balances || {};
        
        const totalAvailable = Object.values(balances).reduce(
          (sum: number, b: unknown) => {
            const balance = b as LeaveBalance;
            return sum + (balance?.available || 0);
          },
          0
        );
        
        const totalAllocated = Object.values(balances).reduce(
          (sum: number, b: unknown) => {
            const balance = b as LeaveBalance;
            return sum + (balance?.allocated || 0);
          },
          0
        );
        
        const totalUsed = Object.values(balances).reduce(
          (sum: number, b: unknown) => {
            const balance = b as LeaveBalance;
            return sum + (balance?.used || 0);
          },
          0
        );
        
        const utilization = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;
        
        setData(prev => ({
          ...prev,
          balances: balances,
          totalAvailable,
          totalAllocated,
          totalUsed,
          utilization,
        }));
        
        console.log("🔄 Balance refreshed:", { totalAvailable, totalAllocated, totalUsed });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error refreshing balance:", error);
      return false;
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch leave balances
      const balanceRes = await fetch("/api/leave/balances", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      });
      let balanceData = { balances: {} };
      if (balanceRes.ok) {
        balanceData = await balanceRes.json();
        console.log("📊 Balance data:", balanceData);
      }

      // ✅ NEW: Fetch Comp-Off balance from credits API
      let compOffBalance = 0;
      let compOffCredits: CompOffCredit[] = [];
      let expiringCompOffCredits: CompOffCredit[] = [];
      
      try {
        const compOffRes = await fetch("/api/comp-off/credits", {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        });
        if (compOffRes.ok) {
          const compOffData = await compOffRes.json();
          const credits = compOffData.credits || [];
          compOffCredits = credits;
          
          // Calculate total available comp-off days
          compOffBalance = credits
            .filter((c: CompOffCredit) => c.status === 'active')
            .reduce((sum: number, c: CompOffCredit) => sum + (c.creditedDays - c.usedDays), 0);
          
          // Find expiring credits (within 30 days)
          const now = new Date();
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          expiringCompOffCredits = credits.filter((c: CompOffCredit) => {
            if (c.status !== 'active') return false;
            const expiryDate = new Date(c.expiryDate);
            return expiryDate <= thirtyDaysFromNow && expiryDate > now;
          });
          
          console.log("📊 Comp-off data:", { compOffBalance, compOffCredits: credits.length, expiring: expiringCompOffCredits.length });
        }
      } catch {
        console.warn("Error fetching comp-off credits");
      }

      // Fetch leave requests
      let requestsData = { requests: [] };
      try {
        const requestsRes = await fetch("/api/leave/my-requests", {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        });
        if (requestsRes.ok) {
          requestsData = await requestsRes.json();
          console.log("📋 Requests data:", requestsData.requests?.length || 0);
        }
      } catch {
        console.warn("Error fetching requests");
      }

      // Fetch overwork summary
      let overworkData = {
        summary: {
          totalApprovedHours: 0,
          pendingHours: 0,
          earnedLeaves: 0,
          progressPercent: 0,
        },
      };
      try {
        const overworkRes = await fetch("/api/overwork/my-summary", {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        });
        if (overworkRes.ok) {
          overworkData = await overworkRes.json();
        }
      } catch {
        console.warn("Error fetching overwork");
      }

      const requests = requestsData.requests || [];

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

      const balances = balanceData.balances || {};
      
      // ✅ FIX: Remove CO from regular balance calculation
      const regularBalances = Object.entries(balances)
        .filter(([type]) => type !== 'CO')
        .reduce((acc, [type, balance]) => ({ ...acc, [type]: balance }), {});
      
      const totalAvailable = Object.values(regularBalances).reduce(
        (sum: number, b: unknown) => {
          const balance = b as LeaveBalance;
          return sum + (balance?.available || 0);
        },
        0
      );
      
      const totalAllocated = Object.values(regularBalances).reduce(
        (sum: number, b: unknown) => {
          const balance = b as LeaveBalance;
          return sum + (balance?.allocated || 0);
        },
        0
      );
      
      const totalUsed = Object.values(regularBalances).reduce(
        (sum: number, b: unknown) => {
          const balance = b as LeaveBalance;
          return sum + (balance?.used || 0);
        },
        0
      );
      
      const utilization = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;

      setData({
        balances: regularBalances,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        revisionRequests,
        totalAvailable,
        totalAllocated,
        totalUsed,
        utilization,
        compOffBalance,
        compOffCredits,
        expiringCompOffCredits,
        overworkSummary: overworkData.summary,
      });
      
      console.log("📊 Dashboard data updated:", {
        pending: pendingRequests,
        revision: revisionRequests,
        compOffBalance,
        expiring: expiringCompOffCredits.length,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (hydrationComplete && user && isMounted) {
        await fetchDashboardData();
      }
    };

    loadData();

    const interval = setInterval(() => {
      if (isMounted && user) {
        refreshBalance();
        fetchDashboardData();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, fetchDashboardData, hydrationComplete, refreshBalance]);

  if (!hydrationComplete || authLoading || loading) {
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
    <div className="container mx-auto py-8 px-4">
      <RoleNavbar
        role={userRoles[0] as Role || "faculty"}
        navItems={navItems}
        greeting={`Welcome back, ${user.name}! 👋`}
        subtitle={`${user.departmentName} • ${getRoleLabel()}`}
      />

      {/* Refresh Buttons */}
      <div className="flex justify-end mb-4 gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchDashboardData()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh All'}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refreshBalance()}
          disabled={loading}
          className="text-green-600 border-green-300 hover:bg-green-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Balance
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5 mb-8 mt-6">
        {/* Total Balance Card - Excluding CO */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Leave Balance</p>
                <p className="text-2xl font-bold text-primary">
                  {data.totalAvailable?.toFixed(1) || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  of {data.totalAllocated?.toFixed(1) || 0} allocated
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs">
                <span>Utilization</span>
                <span>{data.utilization?.toFixed(1) || 0}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(data.utilization || 0, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ✅ NEW: Comp-Off Balance Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Comp-Off Balance</p>
                <p className="text-2xl font-bold text-teal-600">
                  {data.compOffBalance?.toFixed(1) || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.compOffCredits.length} active credit(s)
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-teal-600" />
              </div>
            </div>
            {data.expiringCompOffCredits.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {data.expiringCompOffCredits.length} credit(s) expiring soon
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">
                  {data.pendingRequests || 0}
                </p>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {data.approvedRequests || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total approved</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {data.rejectedRequests || 0}
                </p>
                <p className="text-xs text-muted-foreground">Total rejected</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revision Requests Alert */}
      {data.revisionRequests > 0 && (
        <div className="mb-6">
          <Card className="border-purple-300 bg-purple-50">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-purple-700 font-medium">Needs Revision</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {data.revisionRequests}
                  </p>
                  <p className="text-xs text-purple-600">
                    {data.revisionRequests} request(s) require your attention
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-200 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-700" />
                </div>
              </div>
              <div className="mt-3">
                <Link href="/status">
                  <Button variant="outline" size="sm" className="w-full border-purple-300 text-purple-700 hover:bg-purple-100">
                    Review Revision Requests
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Link href="/request-leave">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary">
              <CardContent className="pt-6 text-center">
                <FilePlus2 className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="font-medium">Request Leave</p>
                <p className="text-xs text-muted-foreground">Submit new request</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/status">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary">
              <CardContent className="pt-6 text-center">
                <ListChecks className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <p className="font-medium">My Status</p>
                <p className="text-xs text-muted-foreground">Track requests</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/stats">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary">
              <CardContent className="pt-6 text-center">
                <BarChart3 className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                <p className="font-medium">Stats</p>
                <p className="text-xs text-muted-foreground">View analytics</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/comp-off">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary">
              <CardContent className="pt-6 text-center">
                <Award className="h-8 w-8 mx-auto text-teal-500 mb-2" />
                <p className="font-medium">Comp Off</p>
                <p className="text-xs text-muted-foreground">Manage comp-off credits</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Leave Balance Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leave Balance Details</CardTitle>
            <CardDescription>Your current leave balances</CardDescription>
          </CardHeader>
          <CardContent>
            {data.balances && Object.keys(data.balances).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data.balances).map(([type, balance]) => {
                  const available = balance?.available ?? 0;
                  const allocated = balance?.allocated ?? 0;
                  const used = balance?.used ?? 0;
                  const pending = balance?.pending ?? 0;
                  const usedPercent = allocated > 0 ? (used / allocated) * 100 : 0;
                  
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{type}</span>
                        <span>
                          {available.toFixed(1)} / {allocated.toFixed(1)} days
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(usedPercent, 100)}%`,
                          }}
                        />
                      </div>
                      {pending > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          {pending} day(s) pending approval
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No leave balances available</p>
            )}
          </CardContent>
        </Card>

        {/* Overwork Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              Overwork Summary
            </CardTitle>
            <CardDescription>Your overwork hours and earned leave</CardDescription>
          </CardHeader>
          <CardContent>
            {data.overworkSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Approved Hours</p>
                    <p className="text-2xl font-bold text-primary">
                      {data.overworkSummary.totalApprovedHours?.toFixed(1) || 0}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Earned Leaves</p>
                    <p className="text-2xl font-bold text-green-600">
                      {data.overworkSummary.earnedLeaves || 0}
                    </p>
                  </div>
                </div>

                {data.overworkSummary.pendingHours > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      <Clock className="inline h-4 w-4 mr-1" />
                      {data.overworkSummary.pendingHours.toFixed(1)} hours pending approval
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Progress to next leave day</span>
                    <span>{data.overworkSummary.progressPercent?.toFixed(0) || 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full transition-all"
                      style={{ width: `${data.overworkSummary.progressPercent || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {5 - (data.overworkSummary.totalApprovedHours % 5)} hours to next leave
                  </p>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push("/overwork")}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Manage Overwork
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No overwork data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resources */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Other Resources</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/comp-off">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 flex items-center gap-4">
                <Award className="h-8 w-8 text-teal-500" />
                <div>
                  <p className="font-medium">Comp Off</p>
                  <p className="text-xs text-muted-foreground">View and use comp off credits</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/overwork">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 flex items-center gap-4">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="font-medium">Overwork</p>
                  <p className="text-xs text-muted-foreground">Track extra hours</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/vacation">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 flex items-center gap-4">
                <Umbrella className="h-8 w-8 text-cyan-500" />
                <div>
                  <p className="font-medium">Vacation</p>
                  <p className="text-xs text-muted-foreground">Apply for vacation leave</p>
                </div>
                <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>
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