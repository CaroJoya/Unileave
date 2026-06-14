// app/principal/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  Clock, 
  Award, 
  Umbrella,
  AlertTriangle,
  ChevronRight
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  pendingApprovals: number;
  pendingOverwork: number;
  pendingCompOff: number;
  pendingVacation: number;
  overrideEligible: number;
}

export default function PrincipalDashboardPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && !user.roles?.includes("principal")) {
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

  // Load data when user is authenticated - fixed with isMounted pattern
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (user?.roles?.includes("principal") && isMounted) {
        await fetchDashboardData();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user, fetchDashboardData]);

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

  const dashboardCards = [
    {
      title: "Pending Direct Approvals",
      count: data?.pendingApprovals || 0,
      icon: CalendarDays,
      href: "/principal/direct-approvals",
      color: "bg-blue-500",
    },
    {
      title: "Pending Overwork",
      count: data?.pendingOverwork || 0,
      icon: Clock,
      href: "/principal/overwork",
      color: "bg-yellow-500",
    },
    {
      title: "Pending Comp Off",
      count: data?.pendingCompOff || 0,
      icon: Award,
      href: "/principal/comp-off",
      color: "bg-green-500",
    },
    {
      title: "Pending Vacation",
      count: data?.pendingVacation || 0,
      icon: Umbrella,
      href: "/principal/vacation",
      color: "bg-purple-500",
    },
    {
      title: "Override Eligible",
      count: data?.overrideEligible || 0,
      icon: AlertTriangle,
      href: "/principal/override-eligible",
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Principal Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          College: {user.collegeName}
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
              <Link href="/principal/direct-approvals">
                <Button className="w-full" variant="outline">
                  Review Direct Approvals
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Link href="/principal/override-eligible">
                <Button className="w-full" variant="outline">
                  Review Override Eligible
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Link href="/principal/overwork">
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