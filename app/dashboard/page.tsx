// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  XCircle,
} from "lucide-react";
import Link from "next/link";

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface DashboardData {
  balances: Record<string, LeaveBalance>;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  overworkSummary: {
    totalApprovedHours: number;
    pendingHours: number;
    earnedLeaves: number;
    progressPercent: number;
  };
}

interface LeaveRequest {
  id: string;
  status: string;
  totalDays: number;
}

export default function DashboardPage() {
  const { user, userRoles, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Auth check - redirect to role-specific dashboards for admin roles
  useEffect(() => {
    if (!authLoading && user) {
      // Redirect admin roles to their specific dashboards
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
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, userRoles, authLoading, router]);

  // Fetch dashboard data
  // In the fetchDashboardData function, add better error handling:

const fetchDashboardData = useCallback(async () => {
  setLoading(true);
  try {
    // Fetch balances
    const balanceRes = await fetch("/api/leave/balances");
    if (!balanceRes.ok) {
      console.warn("Failed to fetch balances:", balanceRes.status);
      // Use empty data instead of failing
    }
    const balanceData = await balanceRes.json().catch(() => ({}));

    // Fetch leave requests - with fallback
    let requestsData = { requests: [] };
    try {
      const requestsRes = await fetch("/api/leave/my-requests");
      if (requestsRes.ok) {
        requestsData = await requestsRes.json();
      } else {
        console.warn("Failed to fetch requests:", requestsRes.status);
      }
    } catch (e) {
      console.warn("Error fetching requests:", e);
    }

    // Fetch overwork summary - with fallback
    let overworkData = { summary: { totalApprovedHours: 0, pendingHours: 0, earnedLeaves: 0, progressPercent: 0 } };
    try {
      const overworkRes = await fetch("/api/overwork/my-summary");
      if (overworkRes.ok) {
        overworkData = await overworkRes.json();
      } else {
        console.warn("Failed to fetch overwork:", overworkRes.status);
      }
    } catch (e) {
      console.warn("Error fetching overwork:", e);
    }

    const requests = requestsData.requests || [];
    
    const pendingRequests = requests.filter(
      (req: LeaveRequest) =>
        req.status === "Pending_HOD" ||
        req.status === "Pending_Registrar" ||
        req.status === "Pending_Principal" ||
        req.status === "Pending_Revision"
    ).length;

    const approvedRequests = requests.filter(
      (req: LeaveRequest) => req.status === "Approved"
    ).length;

    const rejectedRequests = requests.filter(
      (req: LeaveRequest) =>
        req.status === "Rejected_HOD" ||
        req.status === "Rejected_Registrar" ||
        req.status === "Rejected_Principal"
    ).length;

    setData({
      balances: balanceData.balances || {},
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      overworkSummary: overworkData.summary || {
        totalApprovedHours: 0,
        pendingHours: 0,
        earnedLeaves: 0,
        progressPercent: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    // Don't show toast for missing API routes - just use empty data
  } finally {
    setLoading(false);
  }
}, []);

  // Fetch data when user is available
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (user && !user.roles?.some(r => ["super_admin", "head_clerk", "hod", "registrar", "principal"].includes(r)) && isMounted) {
        await fetchDashboardData();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user, fetchDashboardData]);

  // Show loading while checking auth
  if (authLoading || loading) {
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

  // Admin roles are redirected, so this is for staff only
  const isStaff =
    !userRoles.some((r) =>
      ["super_admin", "head_clerk", "hod", "registrar", "principal"].includes(r)
    );

  if (!isStaff) {
    return null;
  }

  const getRoleLabel = () => {
    if (userRoles.includes("faculty")) return "Faculty";
    if (userRoles.includes("lab_assistant")) return "Lab Assistant";
    if (userRoles.includes("office_staff")) return "Office Staff";
    return "Staff";
  };

  const totalAllocated = Object.values(data?.balances || {}).reduce(
    (sum, b) => sum + (b?.allocated || 0),
    0
  );
  const totalUsed = Object.values(data?.balances || {}).reduce(
    (sum, b) => sum + (b?.used || 0),
    0
  );
  const totalAvailable = Object.values(data?.balances || {}).reduce(
    (sum, b) => sum + (b?.available || 0),
    0
  );
  const utilization = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Welcome Section */}
      <div className="mb-8">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user.name}!
            </h1>
            <p className="text-muted-foreground mt-2">
              {user.departmentName} • {getRoleLabel()}
            </p>
          </div>
          <Button onClick={() => router.push("/request-leave")}>
            <FilePlus2 className="h-4 w-4 mr-2" />
            Request Leave
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className="text-2xl font-bold text-primary">{totalAvailable.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">
                  of {totalAllocated.toFixed(1)} allocated
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs">
                <span>Utilization</span>
                <span>{utilization.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-2xl font-bold text-amber-600">
                  {data?.pendingRequests || 0}
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
                  {data?.approvedRequests || 0}
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
                  {data?.rejectedRequests || 0}
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

          <Link href="/vacation">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-transparent hover:border-primary">
              <CardContent className="pt-6 text-center">
                <Umbrella className="h-8 w-8 mx-auto text-cyan-500 mb-2" />
                <p className="font-medium">Vacation</p>
                <p className="text-xs text-muted-foreground">Apply for vacation</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Balance Details & Overwork */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Balance Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leave Balance Details</CardTitle>
            <CardDescription>Your current leave balances</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.balances && Object.keys(data.balances).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data.balances).map(([type, balance]) => (
                  <div key={type}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{type}</span>
                      <span>
                        {balance.available.toFixed(1)} / {balance.allocated.toFixed(1)} days
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${(balance.used / balance.allocated) * 100}%`,
                        }}
                      />
                    </div>
                    {balance.pending > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        {balance.pending} day(s) pending approval
                      </p>
                    )}
                  </div>
                ))}
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
            {data?.overworkSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Approved Hours</p>
                    <p className="text-2xl font-bold text-primary">
                      {data.overworkSummary.totalApprovedHours.toFixed(1)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">Earned Leaves</p>
                    <p className="text-2xl font-bold text-green-600">
                      {data.overworkSummary.earnedLeaves}
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
                    <span>{data.overworkSummary.progressPercent.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full transition-all"
                      style={{ width: `${data.overworkSummary.progressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {5 - (data.overworkSummary.totalApprovedHours % 5)} hours to next leave
                  </p>
                </div>

                <Button variant="outline" className="w-full" onClick={() => router.push("/overwork")}>
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

      {/* Additional Quick Links */}
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