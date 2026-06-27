// app/stats/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CalendarDays, CheckCircle, Clock, Ban, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types
interface LeaveRequest {
  id: string;
  leaveType: string;
  totalDays: number;
  status: string;
  createdAt: string;
  startDate: string;
  endDate: string;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  available: number;
  pending: number;
}

interface MonthlyData {
  month: string;
  leaves: number;
}

interface DistributionData {
  name: string;
  value: number;
  color: string;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface DepartmentData {
  department: string;
  leaves: number;
  pending: number;
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  CL: "#6366F1",
  EL: "#10B981",
  ML: "#F59E0B",
  CO: "#EF4444",
  VL: "#8B5CF6",
  OD: "#EC4899",
  MAT: "#14B8A6",
  PAT: "#F472B6",
  SPL: "#6B7280",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
  CO: "Compensatory Off",
  VL: "Vacation Leave",
  OD: "On Duty",
  MAT: "Maternity Leave",
  PAT: "Paternity Leave",
  SPL: "Special Leave",
};

const STATUS_COLORS: Record<string, string> = {
  Approved: "#10B981",
  Pending_HOD: "#F59E0B",
  Pending_Registrar: "#F59E0B",
  Pending_Principal: "#F59E0B",
  Pending_Revision: "#8B5CF6",
  Rejected_HOD: "#EF4444",
  Rejected_Registrar: "#EF4444",
  Rejected_Principal: "#EF4444",
  Cancelled: "#6B7280",
};

const STATUS_LABELS: Record<string, string> = {
  Approved: "Approved",
  Pending_HOD: "Pending HOD",
  Pending_Registrar: "Pending Registrar",
  Pending_Principal: "Pending Principal",
  Pending_Revision: "Needs Revision",
  Rejected_HOD: "Rejected by HOD",
  Rejected_Registrar: "Rejected by Registrar",
  Rejected_Principal: "Rejected by Principal",
  Cancelled: "Cancelled",
};

export default function StatsPage() {
  const { user, isLoading: authLoading, hydrationComplete } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [statusFilter, setStatusFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [departmentData, setDepartmentData] = useState<DepartmentData[]>([]);
  const [showDepartmentComparison, setShowDepartmentComparison] = useState(false);
  
  const hasFetched = useRef(false);
  const isMounted = useRef(true);

  // Auth check
  useEffect(() => {
    if (!hydrationComplete) return;
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.roles?.includes("principal")) {
      router.push("/principal/dashboard");
      return;
    }
  }, [user, authLoading, router, hydrationComplete]);

  // Fetch data
  const fetchData = useCallback(async () => {
  if (!user) return;
  
  setLoading(true);
  try {
    console.log("📊 Fetching stats data...");
    
    // Fetch leave requests
    const requestsRes = await fetch("/api/leave/my-requests", {
      cache: 'no-store'
    });
    
    if (!requestsRes.ok) {
      const errorText = await requestsRes.text();
      console.error("❌ Requests API Error:", errorText);
      throw new Error(`Failed to fetch requests: ${requestsRes.status}`);
    }
    
    const requestsData = await requestsRes.json();
    console.log("✅ Requests data received:", requestsData);
    setRequests(requestsData.requests || []);
    
    // Fetch balances
    const balancesRes = await fetch("/api/leave/balances", {
      cache: 'no-store'
    });
    
    if (!balancesRes.ok) {
      const errorText = await balancesRes.text();
      console.error("❌ Balances API Error:", errorText);
      throw new Error(`Failed to fetch balances: ${balancesRes.status}`);
    }
    
    const balancesData = await balancesRes.json();
    console.log("✅ Balances data received:", balancesData);
    setBalances(balancesData.balances || {});
    
    // Check if user is HOD or Registrar for department comparison
    const isHodOrRegistrar = user?.roles?.some((r) => r === "hod" || r === "registrar") || false;
    setShowDepartmentComparison(isHodOrRegistrar);

    // If HOD or Registrar, fetch department stats
    if (isHodOrRegistrar) {
      try {
        const deptRes = await fetch("/api/stats/department", {
          cache: 'no-store'
        });
        
        if (deptRes.ok) {
          const deptData = await deptRes.json();
          setDepartmentData(deptData.departments || []);
        }
      } catch (deptError) {
        console.warn("Could not fetch department stats:", deptError);
        setDepartmentData([]);
      }
    }
    
    console.log("✅ Stats data loaded successfully");
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    toast.error(error instanceof Error ? error.message : "Failed to fetch stats data");
    setRequests([]);
    setBalances({});
    setDepartmentData([]);
  } finally {
    if (isMounted.current) {
      setLoading(false);
    }
  }
}, [user]);

  // Fetch data once when user is available
  useEffect(() => {
    if (!hydrationComplete || !user || user.roles?.includes("principal")) return;
    
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData();
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [user, fetchData, hydrationComplete]);

  // Filter by year and status
  const filteredRequests = requests.filter((req) => {
    const reqYear = new Date(req.createdAt).getFullYear().toString();
    if (reqYear !== yearFilter) return false;
    if (statusFilter && req.status !== statusFilter) return false;
    if (leaveTypeFilter && req.leaveType !== leaveTypeFilter) return false;
    return true;
  });

  // Monthly data
  const monthlyData: MonthlyData[] = (() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const totals: Record<string, number> = {};
    months.forEach((m) => totals[m] = 0);
    
    filteredRequests.forEach((req) => {
      const month = new Date(req.createdAt).toLocaleString("default", { month: "short" });
      totals[month] = (totals[month] || 0) + req.totalDays;
    });
    
    return months.map((month) => ({ month, leaves: totals[month] }));
  })();

  // Distribution data
  const distributionData: DistributionData[] = (() => {
    const totals: Record<string, number> = {};
    filteredRequests.forEach((req) => {
      totals[req.leaveType] = (totals[req.leaveType] || 0) + req.totalDays;
    });
    
    return Object.entries(totals)
      .filter(([, value]) => value > 0)
      .map(([type, days]) => ({
        name: LEAVE_TYPE_LABELS[type] || type,
        value: days,
        color: LEAVE_TYPE_COLORS[type] || "#6B7280",
      }));
  })();

  // Status data
  const statusData: StatusData[] = (() => {
    const totals: Record<string, number> = {};
    filteredRequests.forEach((req) => {
      totals[req.status] = (totals[req.status] || 0) + req.totalDays;
    });
    
    return Object.entries(totals)
      .filter(([, value]) => value > 0)
      .map(([status, days]) => ({
        name: STATUS_LABELS[status] || status,
        value: days,
        color: STATUS_COLORS[status] || "#6B7280",
      }));
  })();

  // Calculations
  const totalLeaves = filteredRequests.reduce((sum, req) => sum + req.totalDays, 0);
  const approvedLeaves = filteredRequests.filter(req => req.status === "Approved").reduce((sum, req) => sum + req.totalDays, 0);
  const pendingLeaves = filteredRequests.filter(req => req.status.includes("Pending")).reduce((sum, req) => sum + req.totalDays, 0);
  const rejectedLeaves = filteredRequests.filter(req => req.status.includes("Rejected")).reduce((sum, req) => sum + req.totalDays, 0);
  
  const totalAllocated = Object.values(balances).reduce((sum, b) => sum + (b?.allocated || 0), 0);
  const totalUsed = Object.values(balances).reduce((sum, b) => sum + (b?.used || 0), 0);
  const totalAvailable = Object.values(balances).reduce((sum, b) => sum + (b?.available || 0), 0);
  const utilization = totalAllocated > 0 ? ((totalAllocated - totalAvailable) / totalAllocated * 100) : 0;

  // Unique leave types and statuses for filters
  const uniqueLeaveTypes = [...new Set(requests.map(r => r.leaveType))];
  const uniqueStatuses = [...new Set(requests.map(r => r.status))];

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Month", "Total Leaves"];
    const csvRows = [headers];
    
    for (const data of monthlyData) {
      csvRows.push([data.month, data.leaves.toString()]);
    }
    
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave_stats_${yearFilter}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Stats exported successfully");
  };

  // Helper to format percentage for labels
  const formatPercent = (value: number, total: number) => {
    if (total === 0) return "0%";
    return `${((value / total) * 100).toFixed(0)}%`;
  };

  // Show loading state
  if (!hydrationComplete || authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your stats...</p>
        </div>
      </div>
    );
  }

  if (!user || user.roles?.includes("principal")) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Analytics</h1>
          <p className="text-muted-foreground mt-2">Track your leave patterns and usage</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={monthlyData.length === 0 || monthlyData.every(m => m.leaves === 0)}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {uniqueLeaveTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {LEAVE_TYPE_LABELS[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All status</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status] || status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setYearFilter(new Date().getFullYear().toString());
                  setLeaveTypeFilter("");
                  setStatusFilter("");
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Leaves</p>
                <p className="text-2xl font-bold text-primary">{totalLeaves.toFixed(1)} days</p>
                <p className="text-xs text-muted-foreground">{filteredRequests.length} requests</p>
              </div>
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{approvedLeaves.toFixed(1)} days</p>
                <p className="text-xs text-muted-foreground">
                  {totalLeaves > 0 ? ((approvedLeaves / totalLeaves) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{pendingLeaves.toFixed(1)} days</p>
                <p className="text-xs text-muted-foreground">
                  {totalLeaves > 0 ? ((pendingLeaves / totalLeaves) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{rejectedLeaves.toFixed(1)} days</p>
                <p className="text-xs text-muted-foreground">
                  {totalLeaves > 0 ? ((rejectedLeaves / totalLeaves) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <Ban className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Leave Balance Overview</CardTitle>
          <CardDescription>
            Your current leave balances and utilization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(balances).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No balance data available
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                {Object.entries(balances).map(([type, balance]) => {
                  const usedPercent = balance.allocated > 0 
                    ? ((balance.used / balance.allocated) * 100) 
                    : 0;
                  const isLow = balance.available < balance.allocated * 0.2;
                  
                  return (
                    <div key={type} className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="font-semibold">{LEAVE_TYPE_LABELS[type] || type}</p>
                      <p className="text-2xl font-bold text-primary mt-2">
                        {balance.available.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">available</p>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className={cn(
                            "h-1.5 rounded-full",
                            isLow ? "bg-red-500" : "bg-primary"
                          )}
                          style={{ width: `${Math.min(usedPercent, 100)}%` }} 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {balance.used.toFixed(1)} / {balance.allocated.toFixed(1)} used
                      </p>
                      {balance.pending > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          {balance.pending} pending
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Utilization</p>
                  <p className="text-lg font-bold text-primary">{utilization.toFixed(1)}%</p>
                </div>
                <div className="flex-1 ml-4">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-sm text-muted-foreground">
                  {totalUsed.toFixed(1)} / {totalAllocated.toFixed(1)} days
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="trends">
        <TabsList className="mb-6">
          <TabsTrigger value="trends">Monthly Trends</TabsTrigger>
          <TabsTrigger value="distribution">Leave Distribution</TabsTrigger>
          <TabsTrigger value="status">Status Breakdown</TabsTrigger>
          {showDepartmentComparison && <TabsTrigger value="departments">Departments</TabsTrigger>}
        </TabsList>

        <TabsContent value="trends" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Leave Trends</CardTitle>
              <CardDescription>
                Leave days taken per month in {yearFilter}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyData.every(m => m.leaves === 0) ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No leave data available for {yearFilter}
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="leaves" 
                        stroke="#6366F1" 
                        fill="#6366F1" 
                        fillOpacity={0.3}
                        name="Leave Days"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Leave Type Distribution</CardTitle>
              <CardDescription>
                Breakdown of leave days by type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {distributionData.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No data available for the selected filters
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={distributionData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={100} 
                          label={({ name, value }) => {
                            const total = distributionData.reduce((sum, d) => sum + d.value, 0);
                            return `${name} (${formatPercent(value, total)})`;
                          }}
                        >
                          {distributionData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Leave Type</th>
                          <th className="text-right py-2">Days</th>
                          <th className="text-right py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {distributionData.map((item) => {
                          const total = distributionData.reduce((sum, d) => sum + d.value, 0);
                          return (
                            <tr key={item.name} className="border-b">
                              <td className="py-2">
                                <span 
                                  className="inline-block w-3 h-3 rounded-full mr-2"
                                  style={{ backgroundColor: item.color }}
                                />
                                {item.name}
                              </td>
                              <td className="text-right py-2">{item.value.toFixed(1)}</td>
                              <td className="text-right py-2">
                                {formatPercent(item.value, total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
              <CardDescription>
                Leave days by approval status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No data available for the selected filters
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={statusData} 
                          dataKey="value" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={100} 
                          label={({ name, value }) => {
                            const total = statusData.reduce((sum, d) => sum + d.value, 0);
                            return `${name} (${formatPercent(value, total)})`;
                          }}
                        >
                          {statusData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Status</th>
                          <th className="text-right py-2">Days</th>
                          <th className="text-right py-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusData.map((item) => {
                          const total = statusData.reduce((sum, d) => sum + d.value, 0);
                          return (
                            <tr key={item.name} className="border-b">
                              <td className="py-2">
                                <span 
                                  className="inline-block w-3 h-3 rounded-full mr-2"
                                  style={{ backgroundColor: item.color }}
                                />
                                {item.name}
                              </td>
                              <td className="text-right py-2">{item.value.toFixed(1)}</td>
                              <td className="text-right py-2">
                                {formatPercent(item.value, total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {showDepartmentComparison && (
          <TabsContent value="departments" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Department Comparison</CardTitle>
                <CardDescription>
                  Leave usage across departments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="leaves" fill="#6366F1" name="Total Leaves" />
                      <Bar dataKey="pending" fill="#F59E0B" name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}