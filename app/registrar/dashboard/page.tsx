// app/registrar/dashboard/page.tsx
"use client";

import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  Award, 
  Clock, 
  Umbrella,
  Users,
  CheckCircle,
  Ban,
  ChevronRight
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  pendingLeaves: number;
  pendingCompOff: number;
  pendingOverwork: number;
  pendingVacation: number;
  officeStaffCount: number;
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

  const dashboardCards = [
    {
      title: "Pending Leave Requests",
      count: data?.pendingLeaves || 0,
      icon: CalendarDays,
      href: "/registrar/all-leaves",
      color: "bg-blue-500",
    },
    {
      title: "Pending Comp Off",
      count: data?.pendingCompOff || 0,
      icon: Award,
      href: "/registrar/comp-off",
      color: "bg-green-500",
    },
    {
      title: "Pending Overwork",
      count: data?.pendingOverwork || 0,
      icon: Clock,
      href: "/registrar/overwork",
      color: "bg-yellow-500",
    },
    {
      title: "Pending Vacation",
      count: data?.pendingVacation || 0,
      icon: Umbrella,
      href: "/registrar/vacation",
      color: "bg-purple-500",
    },
    {
      title: "Office Staff",
      count: data?.officeStaffCount || 0,
      icon: Users,
      href: "#",
      color: "bg-gray-500",
    },
    {
      title: "Approved (This Month)",
      count: data?.approvedThisMonth || 0,
      icon: CheckCircle,
      href: "#",
      color: "bg-green-600",
    },
    {
      title: "Rejected (This Month)",
      count: data?.rejectedThisMonth || 0,
      icon: Ban,
      href: "#",
      color: "bg-red-500",
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Registrar Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage office staff leave requests and approvals
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {dashboardCards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <div className={`${card.color} p-2 rounded-full`}>
                  <card.icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.count}</div>
                <div className="flex items-center text-xs text-muted-foreground mt-2">
                  View details
                  <ChevronRight className="h-3 w-3 ml-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <Link href="/registrar/all-leaves">
                <Button className="w-full" variant="outline">
                  Review Leave Requests
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Link href="/registrar/reports">
                <Button className="w-full" variant="outline">
                  Generate Reports
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Link href="/registrar/all-leaves?view=all">
                <Button className="w-full" variant="outline">
                  View All College Leaves
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
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