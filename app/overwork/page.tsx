"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Clock, TrendingUp, Award, Info, CheckCircle, XCircle, CalendarDays, PlusCircle, History } from "lucide-react";
import { EnhancedCard } from "@/components/ui/enhanced-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";

interface OverworkEntry {
  id: string;
  hours: number;
  workDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  convertedToLeave: boolean;
  earnedLeaveDays: number | null;
  createdAt: string;
  approvalRemark?: string | null;
}

interface OverworkSummary {
  totalApprovedHours: number;
  pendingHours: number;
  rejectedHours: number;
  earnedLeaves: number;
  remainingHoursForNext: number;
  progressPercent: number;
  conversionRate: number;
}

export default function OverworkPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<OverworkEntry[]>([]);
  const [summary, setSummary] = useState<OverworkSummary | null>(null);
  const [config, setConfig] = useState<{ conversionHours: number } | null>(null);
  const [formData, setFormData] = useState({
    workDate: "",
    hours: "",
    reason: "",
  });

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && user.roles?.includes("principal")) {
      router.push("/principal/dashboard");
    }
  }, [user, authLoading, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch config
      const configRes = await fetch("/api/headclerk/overwork-config");
      const configData = await configRes.json();
      if (configData.config) {
        setConfig({
          conversionHours: configData.config.conversionHours || 5,
        });
      }

      // Fetch summary
      const summaryRes = await fetch("/api/overwork/my-summary");
      const summaryData = await summaryRes.json();
      if (summaryRes.ok) {
        setSummary(summaryData.summary);
      }

      // Fetch history
      const historyRes = await fetch("/api/overwork/my-history");
      const historyData = await historyRes.json();
      if (historyRes.ok) {
        setEntries(historyData.entries || []);
      }
    } catch (error) {
      console.error("Error fetching overwork data:", error);
      toast.error("Failed to fetch overwork data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when user is available
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (user && !user.roles?.includes("principal") && isMounted) {
        await fetchData();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user, fetchData]);

  const handleSubmit = async () => {
    if (!formData.workDate) {
      toast.error("Please select a date");
      return;
    }
    if (!formData.hours) {
      toast.error("Please enter hours");
      return;
    }

    const hours = parseFloat(formData.hours);
    if (isNaN(hours) || hours <= 0) {
      toast.error("Please enter a valid number of hours");
      return;
    }

    if (config) {
      if (hours < 0.5) {
        toast.error("Minimum hours per entry is 0.5");
        return;
      }
      if (hours > 24) {
        toast.error("Maximum hours per day is 24");
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/overwork/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: formData.workDate,
          hours: hours,
          reason: formData.reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit overwork");
      }

      toast.success("Overwork hours submitted successfully");
      setFormData({ workDate: "", hours: "", reason: "" });
      
      await fetchData();
      
      toast.success("📊 Overwork data updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
    }
  };


  const totalEntries = entries.length;
  const approvedEntries = entries.filter(e => e.status === "approved").length;
  const pendingEntries = entries.filter(e => e.status === "pending").length;
  const rejectedEntries = entries.filter(e => e.status === "rejected").length;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user || user.roles?.includes("principal")) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            Overwork Tracking
          </h1>
          <p className="text-muted-foreground mt-1.5 text-base">
            Track your extra work hours and earn compensatory leave
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/comp-off")}
          className="gap-2"
        >
          <Award className="h-4 w-4" />
          View Comp-Off
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          label="Approved Hours"
          value={`${summary?.totalApprovedHours.toFixed(1) || "0"}`}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
          trend={{
            value: summary ? Math.round((summary.totalApprovedHours / (summary.totalApprovedHours + summary.pendingHours + summary.rejectedHours)) * 100) : 0,
            label: "of total",
            direction: "up"
          }}
        />
        <StatCard
          label="Pending Hours"
          value={`${summary?.pendingHours.toFixed(1) || "0"}`}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          label="Earned Leaves"
          value={summary?.earnedLeaves || 0}
          icon={<Award className="h-5 w-5" />}
          color="teal"
        />
        <StatCard
          label="Conversion Rate"
          value={`${config?.conversionHours || 5}h`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="primary"
        />
      </div>

      {/* Progress Bar */}
      {summary && summary.totalApprovedHours > 0 && (
        <EnhancedCard 
          variant="elevated"
          accentColor="amber"
          className="mb-8"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Progress to Next Leave Day</h4>
                <p className="text-sm text-muted-foreground">
                  {summary.remainingHoursForNext.toFixed(1)} hours needed for 1 more leave day
                </p>
              </div>
              <div className="ml-auto text-lg font-bold text-amber-600">
                {summary.progressPercent.toFixed(0)}%
              </div>
            </div>
          }
        >
          <div className="space-y-2">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${summary.progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="font-medium text-amber-700">
                {summary.remainingHoursForNext.toFixed(1)} hours remaining
              </span>
              <span>100%</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1">
              <span>Hours worked: {summary.totalApprovedHours.toFixed(1)}</span>
              <span>Next leave at: {(Math.floor(summary.totalApprovedHours / (config?.conversionHours || 5)) + 1) * (config?.conversionHours || 5)}h</span>
            </div>
          </div>
        </EnhancedCard>
      )}

      {/* Add Overwork Form */}
      <EnhancedCard 
        variant="elevated"
        className="mb-8"
        header={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Add Overwork Hours</h3>
              <p className="text-sm text-muted-foreground">
                Every {config?.conversionHours || 5} hours = 1 earned leave day
              </p>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workDate" className="text-sm font-medium">Work Date *</Label>
              <Input
                id="workDate"
                type="date"
                value={formData.workDate}
                onChange={(e) => setFormData({ ...formData, workDate: e.target.value })}
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours" className="text-sm font-medium">Hours *</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                placeholder="e.g., 5"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                required
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Min: 0.5 | Max: 24 hours/day
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Textarea
              id="reason"
              placeholder="Describe why you worked extra hours (e.g., Exam duty on Sunday)"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium">About Overwork</p>
                <ul className="text-sm text-blue-700 mt-1 list-disc list-inside space-y-1">
                  <li>Every <strong>{config?.conversionHours || 5}</strong> approved hours = 1 earned leave day</li>
                  <li>Your overwork request will be sent for approval</li>
                  <li>Once approved, comp-off credits will be added to your account</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={submitting} 
            className="w-full gap-2"
          >
            {submitting ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Submitting...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                Submit Overwork
              </>
            )}
          </Button>
        </div>
      </EnhancedCard>

      {/* Overwork History */}
      <SectionHeader
        title="Overwork History"
        subtitle={`${totalEntries} entry${totalEntries !== 1 ? "s" : ""} • ${approvedEntries} approved • ${pendingEntries} pending • ${rejectedEntries} rejected`}
        icon={<History className="h-5 w-5" />}
        className="mb-4"
      />

      <EnhancedCard 
        variant="elevated"
      >
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-gray-100">
                <Clock className="h-12 w-12 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900">No overwork entries found</h4>
              <p className="text-sm text-muted-foreground">Submit your first entry above to start tracking</p>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Hours</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Earned Leave</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        {new Date(entry.workDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {entry.hours}
                    </td>
                    <td className="p-3 max-w-xs truncate text-muted-foreground">
                      {entry.reason || "-"}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="p-3">
                      {entry.convertedToLeave && entry.earnedLeaveDays ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                          <Award className="h-3 w-3" />
                          {entry.earnedLeaveDays} day(s)
                        </span>
                      ) : entry.status === "approved" ? (
                        <span className="text-muted-foreground text-xs">
                          {Math.floor(entry.hours / (config?.conversionHours || 5))} days
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </EnhancedCard>

      {/* Quick Stats Footer */}
      {entries.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-sm text-green-700">Approved Entries</p>
            <p className="text-2xl font-bold text-green-600">{approvedEntries}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-sm text-yellow-700">Pending Entries</p>
            <p className="text-2xl font-bold text-yellow-600">{pendingEntries}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-sm text-red-700">Rejected Entries</p>
            <p className="text-2xl font-bold text-red-600">{rejectedEntries}</p>
          </div>
        </div>
      )}
    </div>
  );
}