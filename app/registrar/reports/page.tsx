"use client";

import React from "react";
import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface MonthlyReportData {
  summary: {
    year: number;
    month: number;
    monthName: string;
    totalRequests: number;
    approved: number;
    rejected: number;
    pending: number;
    revision: number;
    approvalRate: string;
  };
  departmentBreakdown: { departmentName: string; total: number; approved: number; rejected: number }[];
  leaveTypeBreakdown: Record<string, { count: number; totalDays: number }>;
  dailyBreakdown: { date: string; total: number; approved: number; rejected: number }[];
}

interface AnnualReportData {
  academicYear: string;
  summary: {
    totalRequests: number;
    totalApproved: number;
    totalRejected: number;
    totalDays: number;
    averagePerMonth: string;
    approvalRate: string;
  };
  monthlyBreakdown: { month: string; total: number; approved: number; rejected: number }[];
  departmentSummary: { departmentName: string; total: number; approved: number; totalDays: number }[];
  leaveTypeSummary: Record<string, { count: number; totalDays: number }>;
}

interface UtilizationData {
  academicYear: string;
  summary: {
    totalDepartments: number;
    totalEmployees: number;
    totalAllocated: number;
    totalUsed: number;
    totalRemaining: number;
    overallUtilization: number;
  };
  departments: {
    departmentId: string;
    departmentName: string;
    employeeCount: number;
    allocatedLeaves: number;
    usedLeaves: number;
    remainingLeaves: number;
    utilizationPercent: number;
  }[];
}

interface LeaveTypeStatsData {
  academicYear: string;
  summary: {
    totalRequests: number;
    totalDays: number;
    averageDaysPerRequest: number;
  };
  leaveTypeStats: {
    leaveCode: string;
    leaveName: string;
    requestCount: number;
    totalDays: number;
    averageDaysPerRequest: number;
    percentageOfTotal: number;
    color: string;
  }[];
  monthlyTrend: { month: string; CL: number; EL: number; ML: number; CO: number; VL: number; OD: number }[];
}

interface OverrideData {
  summary: {
    totalOverrides: number;
    uniqueDepartments: number;
    uniqueReasons: number;
  };
  overridesByDepartment: { department: string; count: number }[];
  overridesByReason: { reason: string; count: number }[];
  overridesByMonth: { month: string; count: number }[];
  overrides: {
    requestId: string;
    applicantName: string;
    departmentName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    originalApprover: string;
    originalApproverRole: string;
    overriddenBy: string;
    overriddenByRole: string;
    overrideReason: string | null;
    overriddenAt: string | null;
    finalStatus: string;
  }[];
}

interface ExportDataItem {
  [key: string]: string | number;
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  CL: "#6366F1",
  EL: "#10B981",
  ML: "#F59E0B",
  CO: "#EF4444",
  VL: "#8B5CF6",
  OD: "#EC4899",
};

export default function RegistrarReportsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("monthly");
  
  // Report states
  const [monthlyData, setMonthlyData] = useState<MonthlyReportData | null>(null);
  const [annualData, setAnnualData] = useState<AnnualReportData | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData | null>(null);
  const [leaveTypeData, setLeaveTypeData] = useState<LeaveTypeStatsData | null>(null);
  const [overrideData, setOverrideData] = useState<OverrideData | null>(null);
  
  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [overrideStartDate, setOverrideStartDate] = useState("");
  const [overrideEndDate, setOverrideEndDate] = useState("");
  
  // Generate academic year options
  const currentYear = new Date().getFullYear();
  const academicYears = [
    `${currentYear - 1}-${currentYear}`,
    `${currentYear}-${currentYear + 1}`,
    `${currentYear + 1}-${currentYear + 2}`,
  ];

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && !user.roles?.includes("registrar")) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  // Set default academic year - using useMemo to avoid setState in effect
  // Set default academic year
const hasSetAcademicYear = React.useRef(false);
useEffect(() => {
  if (!hasSetAcademicYear.current) {
    const now = new Date();
    const currentMonth = now.getMonth();
    let defaultYear = "";
    if (currentMonth >= 5) {
      defaultYear = `${currentYear}-${currentYear + 1}`;
    } else {
      defaultYear = `${currentYear - 1}-${currentYear}`;
    }
    setTimeout(() => {
      setSelectedAcademicYear(defaultYear);
    }, 0);
    hasSetAcademicYear.current = true;
  }
}, [currentYear]);
  // Fetch monthly report
  const fetchMonthlyReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: selectedYear,
        month: selectedMonth,
      });
      
      const response = await fetch(`/api/registrar/reports/monthly?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch monthly report");
      }
      
      setMonthlyData(data);
    } catch (error) {
      console.error("Error fetching monthly report:", error);
      toast.error("Failed to fetch monthly report");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  // Fetch annual report
  const fetchAnnualReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        academicYear: selectedAcademicYear,
      });
      
      const response = await fetch(`/api/registrar/reports/annual?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch annual report");
      }
      
      setAnnualData(data);
    } catch (error) {
      console.error("Error fetching annual report:", error);
      toast.error("Failed to fetch annual report");
    } finally {
      setLoading(false);
    }
  }, [selectedAcademicYear]);

  // Fetch utilization report
  const fetchUtilizationReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        academicYear: selectedAcademicYear,
      });
      
      const response = await fetch(`/api/registrar/reports/utilization?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch utilization report");
      }
      
      setUtilizationData(data);
    } catch (error) {
      console.error("Error fetching utilization report:", error);
      toast.error("Failed to fetch utilization report");
    } finally {
      setLoading(false);
    }
  }, [selectedAcademicYear]);

  // Fetch leave type statistics
  const fetchLeaveTypeStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        academicYear: selectedAcademicYear,
      });
      
      const response = await fetch(`/api/registrar/reports/leave-types?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch leave type statistics");
      }
      
      setLeaveTypeData(data);
    } catch (error) {
      console.error("Error fetching leave type stats:", error);
      toast.error("Failed to fetch leave type statistics");
    } finally {
      setLoading(false);
    }
  }, [selectedAcademicYear]);

  // Fetch override report
  const fetchOverrideReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (overrideStartDate) params.append("startDate", overrideStartDate);
      if (overrideEndDate) params.append("endDate", overrideEndDate);
      
      const response = await fetch(`/api/registrar/reports/overrides?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch override report");
      }
      
      setOverrideData(data);
    } catch (error) {
      console.error("Error fetching override report:", error);
      toast.error("Failed to fetch override report");
    } finally {
      setLoading(false);
    }
  }, [overrideStartDate, overrideEndDate]);

  // Load data when tab changes - using a separate effect that doesn't call setState directly
  useEffect(() => {
    const loadData = async () => {
      if (activeTab === "monthly") {
        await fetchMonthlyReport();
      } else if (activeTab === "annual") {
        await fetchAnnualReport();
      } else if (activeTab === "utilization") {
        await fetchUtilizationReport();
      } else if (activeTab === "leave-types") {
        await fetchLeaveTypeStats();
      } else if (activeTab === "overrides") {
        await fetchOverrideReport();
      }
    };
    loadData();
  }, [activeTab, fetchMonthlyReport, fetchAnnualReport, fetchUtilizationReport, fetchLeaveTypeStats, fetchOverrideReport]);

  // Export to CSV helper
  const exportToCSV = (data: ExportDataItem[], filename: string, headers: string[]) => {
    const csvRows = [headers.join(",")];
    for (const row of data) {
      const values = headers.map(h => {
        const value = row[h];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value !== undefined && value !== null ? String(value) : "";
      });
      csvRows.push(values.join(","));
    }
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Generate and export reports for leave analytics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
          <TabsTrigger value="annual">Annual Report</TabsTrigger>
          <TabsTrigger value="utilization">Department Utilization</TabsTrigger>
          <TabsTrigger value="leave-types">Leave Type Statistics</TabsTrigger>
          <TabsTrigger value="overrides">Override Tracking</TabsTrigger>
        </TabsList>

        {/* Monthly Report Tab */}
        <TabsContent value="monthly">
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2023, 2024, 2025, 2026].map(y => (
                          <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {new Date(2000, i, 1).toLocaleString("default", { month: "long" })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={fetchMonthlyReport}>Generate Report</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {monthlyData && (
              <>
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-5">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-bold">{monthlyData.summary.totalRequests}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Approved</p>
                      <p className="text-2xl font-bold text-green-600">{monthlyData.summary.approved}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Rejected</p>
                      <p className="text-2xl font-bold text-red-600">{monthlyData.summary.rejected}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">{monthlyData.summary.pending}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Approval Rate</p>
                      <p className="text-2xl font-bold text-primary">{monthlyData.summary.approvalRate}%</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Trend Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Request Trend</CardTitle>
                    <CardDescription>Leave requests submitted per day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyData.dailyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="total" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} name="Total" />
                          <Area type="monotone" dataKey="approved" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Approved" />
                          <Area type="monotone" dataKey="rejected" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} name="Rejected" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Leave Type Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Leave Type Breakdown</CardTitle>
                    <CardDescription>Distribution by leave category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(monthlyData.leaveTypeBreakdown).map(([type, data]) => ({
                                name: type,
                                value: data.count,
                                color: LEAVE_TYPE_COLORS[type] || "#6B7280",
                              }))}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label
                            >
                              {Object.entries(monthlyData.leaveTypeBreakdown).map(([type], idx) => (
                                <Cell key={`cell-${idx}`} fill={LEAVE_TYPE_COLORS[type] || "#6B7280"} />
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
                              <th className="text-right py-2">Requests</th>
                              <th className="text-right py-2">Total Days</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(monthlyData.leaveTypeBreakdown).map(([type, data]) => (
                              <tr key={type} className="border-b">
                                <td className="py-2">{type}</td>
                                <td className="text-right py-2">{data.count}</td>
                                <td className="text-right py-2">{data.totalDays}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const exportData: ExportDataItem[] = monthlyData.dailyBreakdown.map(d => ({
                        date: d.date,
                        total: d.total,
                        approved: d.approved,
                        rejected: d.rejected,
                      }));
                      exportToCSV(exportData, `monthly_report_${monthlyData.summary.year}_${monthlyData.summary.month}`, ["date", "total", "approved", "rejected"]);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Annual Report Tab */}
        <TabsContent value="annual">
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Academic Year</Label>
                    <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {academicYears.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={fetchAnnualReport}>Generate Report</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {annualData && (
              <>
                <div className="grid gap-4 md:grid-cols-5">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-bold">{annualData.summary.totalRequests}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Approved</p>
                      <p className="text-2xl font-bold text-green-600">{annualData.summary.totalApproved}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Rejected</p>
                      <p className="text-2xl font-bold text-red-600">{annualData.summary.totalRejected}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Days</p>
                      <p className="text-2xl font-bold">{annualData.summary.totalDays}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Approval Rate</p>
                      <p className="text-2xl font-bold text-primary">{annualData.summary.approvalRate}%</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Trend</CardTitle>
                    <CardDescription>Leave requests by month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={annualData.monthlyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="total" fill="#6366F1" name="Total Requests" />
                          <Bar dataKey="approved" fill="#10B981" name="Approved" />
                          <Bar dataKey="rejected" fill="#EF4444" name="Rejected" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const exportData: ExportDataItem[] = annualData.monthlyBreakdown.map(m => ({
                        month: m.month,
                        total: m.total,
                        approved: m.approved,
                        rejected: m.rejected,
                      }));
                      exportToCSV(exportData, `annual_report_${annualData.academicYear}`, ["month", "total", "approved", "rejected"]);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Department Utilization Tab */}
        <TabsContent value="utilization">
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Academic Year</Label>
                    <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {academicYears.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={fetchUtilizationReport}>Generate Report</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {utilizationData && (
              <>
                <div className="grid gap-4 md:grid-cols-5">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Departments</p>
                      <p className="text-2xl font-bold">{utilizationData.summary.totalDepartments}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Employees</p>
                      <p className="text-2xl font-bold">{utilizationData.summary.totalEmployees}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Allocated Leaves</p>
                      <p className="text-2xl font-bold">{utilizationData.summary.totalAllocated}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Used Leaves</p>
                      <p className="text-2xl font-bold text-orange-600">{utilizationData.summary.totalUsed}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Utilization</p>
                      <p className="text-2xl font-bold text-primary">{utilizationData.summary.overallUtilization}%</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Department Utilization Chart</CardTitle>
                    <CardDescription>Leave usage by department</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={utilizationData.departments} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 100]} unit="%" />
                          <YAxis type="category" dataKey="departmentName" width={120} />
                          <Tooltip formatter={(value) => `${value}%`} />
                          <Bar dataKey="utilizationPercent" fill="#6366F1" name="Utilization %">
                            {utilizationData.departments.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.utilizationPercent > 80 ? "#EF4444" : entry.utilizationPercent > 50 ? "#F59E0B" : "#10B981"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const exportData: ExportDataItem[] = utilizationData.departments.map(d => ({
                        departmentName: d.departmentName,
                        employeeCount: d.employeeCount,
                        allocatedLeaves: d.allocatedLeaves,
                        usedLeaves: d.usedLeaves,
                        remainingLeaves: d.remainingLeaves,
                        utilizationPercent: d.utilizationPercent,
                      }));
                      exportToCSV(exportData, `utilization_${utilizationData.academicYear}`, ["departmentName", "employeeCount", "allocatedLeaves", "usedLeaves", "remainingLeaves", "utilizationPercent"]);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Leave Type Statistics Tab */}
        <TabsContent value="leave-types">
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Academic Year</Label>
                    <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {academicYears.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={fetchLeaveTypeStats}>Generate Report</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {leaveTypeData && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                      <p className="text-2xl font-bold">{leaveTypeData.summary.totalRequests}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Days</p>
                      <p className="text-2xl font-bold">{leaveTypeData.summary.totalDays}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Avg Days/Request</p>
                      <p className="text-2xl font-bold">{leaveTypeData.summary.averageDaysPerRequest}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Leave Type Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={leaveTypeData.leaveTypeStats}
                              dataKey="totalDays"
                              nameKey="leaveName"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label
                            >
                              {leaveTypeData.leaveTypeStats.map((entry, idx) => (
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
                              <th className="text-right py-2">Requests</th>
                              <th className="text-right py-2">Days</th>
                              <th className="text-right py-2">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaveTypeData.leaveTypeStats.map((stat) => (
                              <tr key={stat.leaveCode} className="border-b">
                                <td className="py-2">{stat.leaveName}</td>
                                <td className="text-right py-2">{stat.requestCount}</td>
                                <td className="text-right py-2">{stat.totalDays}</td>
                                <td className="text-right py-2">{stat.percentageOfTotal}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const exportData: ExportDataItem[] = leaveTypeData.leaveTypeStats.map(stat => ({
                        leaveName: stat.leaveName,
                        requestCount: stat.requestCount,
                        totalDays: stat.totalDays,
                        averageDaysPerRequest: stat.averageDaysPerRequest,
                        percentageOfTotal: stat.percentageOfTotal,
                      }));
                      exportToCSV(exportData, `leave_type_stats_${leaveTypeData.academicYear}`, ["leaveName", "requestCount", "totalDays", "averageDaysPerRequest", "percentageOfTotal"]);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Override Tracking Tab */}
        <TabsContent value="overrides">
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={overrideStartDate} onChange={(e) => setOverrideStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" value={overrideEndDate} onChange={(e) => setOverrideEndDate(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={fetchOverrideReport}>Generate Report</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {overrideData && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Total Overrides</p>
                      <p className="text-2xl font-bold text-orange-600">{overrideData.summary.totalOverrides}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Departments Affected</p>
                      <p className="text-2xl font-bold">{overrideData.summary.uniqueDepartments}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Unique Reasons</p>
                      <p className="text-2xl font-bold">{overrideData.summary.uniqueReasons}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Overrides by Month</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overrideData.overridesByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#F59E0B" name="Overrides" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Override Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left p-3">Employee</th>
                            <th className="text-left p-3">Department</th>
                            <th className="text-left p-3">Leave Type</th>
                            <th className="text-left p-3">Original Approver</th>
                            <th className="text-left p-3">Overridden By</th>
                            <th className="text-left p-3">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overrideData.overrides.map((override) => (
                            <tr key={override.requestId} className="border-t">
                              <td className="p-3">{override.applicantName}</td>
                              <td className="p-3">{override.departmentName}</td>
                              <td className="p-3">{override.leaveType}</td>
                              <td className="p-3">{override.originalApprover}</td>
                              <td className="p-3">{override.overriddenBy}</td>
                              <td className="p-3 max-w-xs truncate">{override.overrideReason || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const exportData: ExportDataItem[] = overrideData.overrides.map(o => ({
                        applicantName: o.applicantName,
                        departmentName: o.departmentName,
                        leaveType: o.leaveType,
                        originalApprover: o.originalApprover,
                        overriddenBy: o.overriddenBy,
                        overrideReason: o.overrideReason || "",
                      }));
                      exportToCSV(exportData, "override_report", ["applicantName", "departmentName", "leaveType", "originalApprover", "overriddenBy", "overrideReason"]);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}