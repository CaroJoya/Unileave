"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { CalendarDays, TrendingUp, CheckCircle, Clock } from "lucide-react";

// Types
interface LeaveRequest {
  id: string;
  leaveType: string;
  totalDays: number;
  status: string;
  createdAt: string;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  available: number;
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
  OD: "#8B5CF6",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
  CO: "Compensatory Off",
  OD: "On Duty",
};

export default function StatsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [showDepartmentComparison, setShowDepartmentComparison] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const requestsRes = await fetch("/api/leave/my-requests");
        const requestsData = await requestsRes.json();
        if (requestsRes.ok) {
          setRequests(requestsData.requests || []);
        }
        
        const balancesRes = await fetch("/api/leave/balances");
        const balancesData = await balancesRes.json();
        if (balancesRes.ok) {
          setBalances(balancesData.balances || {});
        }
        
        const isHodOrRegistrar = user?.roles?.some(r => r === "hod" || r === "registrar") || false;
        setShowDepartmentComparison(isHodOrRegistrar);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchData();
    }
  }, [user]);

  // Filter by year
  const filteredRequests = requests.filter((req) => {
    const reqYear = new Date(req.createdAt).getFullYear().toString();
    return reqYear === yearFilter;
  });

  // Monthly data
  const monthlyData: MonthlyData[] = (() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const totals: Record<string, number> = {};
    months.forEach(m => totals[m] = 0);
    
    filteredRequests.forEach((req) => {
      const month = new Date(req.createdAt).toLocaleString("default", { month: "short" });
      totals[month] += req.totalDays;
    });
    
    return months.map(month => ({ month, leaves: totals[month] }));
  })();

  // Distribution data
  const distributionData: DistributionData[] = (() => {
    const totals: Record<string, number> = {};
    filteredRequests.forEach((req) => {
      totals[req.leaveType] = (totals[req.leaveType] || 0) + req.totalDays;
    });
    
    return Object.entries(totals).map(([type, days]) => ({
      name: LEAVE_TYPE_LABELS[type] || type,
      value: days,
      color: LEAVE_TYPE_COLORS[type] || "#6B7280",
    }));
  })();

  // Status data
  const statusData: StatusData[] = (() => {
    let approved = 0, pending = 0, rejected = 0;
    filteredRequests.forEach((req) => {
      if (req.status === "Approved") approved += req.totalDays;
      else if (req.status.includes("Pending")) pending += req.totalDays;
      else if (req.status.includes("Rejected")) rejected += req.totalDays;
    });
    
    return [
      { name: "Approved", value: approved, color: "#10B981" },
      { name: "Pending", value: pending, color: "#F59E0B" },
      { name: "Rejected", value: rejected, color: "#EF4444" },
    ];
  })();

  // Department data (mock for now - replace with actual API call)
  const departmentData: DepartmentData[] = [
    { department: "Computer Science", leaves: 45, pending: 8 },
    { department: "Electronics", leaves: 32, pending: 5 },
    { department: "Mechanical", leaves: 28, pending: 6 },
    { department: "Civil", leaves: 35, pending: 4 },
  ];

  // Calculations
  const totalLeaves = filteredRequests.reduce((sum, req) => sum + req.totalDays, 0);
  const approvedLeaves = filteredRequests.filter(req => req.status === "Approved").reduce((sum, req) => sum + req.totalDays, 0);
  const pendingLeaves = filteredRequests.filter(req => req.status.includes("Pending")).reduce((sum, req) => sum + req.totalDays, 0);
  
  const totalAllocated = Object.values(balances).reduce((sum, b) => sum + (b?.allocated || 0), 0);
  const totalAvailable = Object.values(balances).reduce((sum, b) => sum + (b?.available || 0), 0);
  const utilization = totalAllocated > 0 ? ((totalAllocated - totalAvailable) / totalAllocated * 100) : 0;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Leave Analytics</h1>
          <p className="text-muted-foreground mt-2">Track your leave patterns</p>
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Leaves</p>
                <p className="text-2xl font-bold">{totalLeaves} days</p>
              </div>
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{approvedLeaves} days</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{pendingLeaves} days</p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold text-primary">{utilization.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Overview */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Leave Balance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {Object.entries(balances).map(([type, balance]) => (
              <div key={type} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold">{LEAVE_TYPE_LABELS[type] || type}</p>
                <p className="text-2xl font-bold text-primary mt-2">{balance?.available || 0}</p>
                <p className="text-xs text-muted-foreground">available</p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-primary h-1.5 rounded-full" 
                    style={{ width: `${((balance?.used || 0) / (balance?.allocated || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">Monthly Trends</TabsTrigger>
          <TabsTrigger value="distribution">Leave Distribution</TabsTrigger>
          <TabsTrigger value="status">Status Breakdown</TabsTrigger>
          {showDepartmentComparison && <TabsTrigger value="departments">Departments</TabsTrigger>}
        </TabsList>

        <TabsContent value="trends" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="leaves" stroke="#6366F1" fill="#6366F1" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="mt-6">
          <Card>
            <CardContent className="pt-6">
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
                      label 
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="mt-6">
          <Card>
            <CardContent className="pt-6">
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
                      label
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
            </CardContent>
          </Card>
        </TabsContent>

        {showDepartmentComparison && (
          <TabsContent value="departments" className="mt-6">
            <Card>
              <CardContent className="pt-6">
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