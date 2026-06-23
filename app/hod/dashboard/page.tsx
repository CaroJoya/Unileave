"use client";

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
  ChevronRight
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  pendingLeaves: number;
  pendingCompOff: number;
  pendingOverwork: number;
  pendingVacation: number;
  facultyCount: number;
}

export default function HODDashboardPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const hasRedirected = useRef(false);
  const hasFetched = useRef(false);

  // Auth check - runs only once
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

  // Data fetch - runs only once
  useEffect(() => {
    if (user?.roles?.includes("hod") && !hasFetched.current) {
      hasFetched.current = true;
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Show loading while checking auth
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

  const dashboardCards = [
    {
      title: "Pending Leave Requests",
      count: data?.pendingLeaves || 0,
      icon: CalendarDays,
      href: "/hod/faculty-requests",
      color: "bg-blue-500",
    },
    {
      title: "Pending Comp Off",
      count: data?.pendingCompOff || 0,
      icon: Award,
      href: "/hod/comp-off",
      color: "bg-green-500",
    },
    {
      title: "Pending Overwork",
      count: data?.pendingOverwork || 0,
      icon: Clock,
      href: "/hod/overwork",
      color: "bg-yellow-500",
    },
    {
      title: "Pending Vacation",
      count: data?.pendingVacation || 0,
      icon: Umbrella,
      href: "/hod/vacation",
      color: "bg-purple-500",
    },
    {
      title: "Department Faculty",
      count: data?.facultyCount || 0,
      icon: Users,
      href: "#",
      color: "bg-gray-500",
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">HOD Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Department: {user.departmentName}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
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

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <Link href="/hod/faculty-requests">
                <Button className="w-full" variant="outline">
                  Review Leave Requests
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Link href="/hod/comp-off">
                <Button className="w-full" variant="outline">
                  Review Comp Off
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Link href="/hod/overwork">
                <Button className="w-full" variant="outline">
                  Review Overwork
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}