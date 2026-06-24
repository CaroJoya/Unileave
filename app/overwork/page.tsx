// app/overwork/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Clock, TrendingUp, Award, Info, CheckCircle, XCircle } from "lucide-react";

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
      
      // ✅ SMART REDIRECT: Refresh the page to see updated data
      // The page already stays on the same page and refreshes data
      await fetchData();
      
      // Extra toast to confirm refresh
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
    }
  };

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Overwork Tracking</h1>
        <p className="text-muted-foreground mt-2">
          Track your extra work hours and earn compensatory leave
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Hours</p>
                <p className="text-2xl font-bold text-primary">
                  {summary?.totalApprovedHours.toFixed(1) || "0"}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Hours</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {summary?.pendingHours.toFixed(1) || "0"}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Earned Leaves</p>
                <p className="text-2xl font-bold text-green-600">
                  {summary?.earnedLeaves || 0}
                </p>
              </div>
              <Award className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
              <p className="text-2xl font-bold">{config?.conversionHours || 5}h</p>
              <p className="text-xs text-muted-foreground">= 1 earned leave day</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {summary && summary.totalApprovedHours > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress to next leave day</span>
                <span>{summary.progressPercent.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full transition-all"
                  style={{ width: `${summary.progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.remainingHoursForNext.toFixed(1)} hours to next leave day
                ({(summary.totalApprovedHours % (config?.conversionHours || 5)).toFixed(1)} /{" "}
                {config?.conversionHours || 5} hours)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Overwork Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add Overwork Hours</CardTitle>
          <CardDescription>
            Record extra work hours for approval. Every {config?.conversionHours || 5} hours = 1 earned leave day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="workDate">Work Date *</Label>
                <Input
                  id="workDate"
                  type="date"
                  value={formData.workDate}
                  onChange={(e) => setFormData({ ...formData, workDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">Hours *</Label>
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
                />
                <p className="text-xs text-muted-foreground">
                  Min: 0.5 | Max: 24 hours/day
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Describe why you worked extra hours (e.g., Exam duty on Sunday)"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">About Overwork</p>
                  <ul className="text-sm text-blue-700 mt-1 list-disc list-inside space-y-1">
                    <li>Every {config?.conversionHours || 5} approved hours = 1 earned leave day</li>
                    <li>Your overwork request will be sent for approval</li>
                    <li>Once approved, comp-off credits will be added to your account</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Submitting...
                </>
              ) : (
                "Submit Overwork"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overwork History */}
      <Card>
        <CardHeader>
          <CardTitle>Overwork History</CardTitle>
          <CardDescription>View all your submitted overwork entries</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p>No overwork entries found</p>
              <p className="text-sm mt-1">Submit your first entry above</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Hours</th>
                    <th className="text-left p-3">Reason</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Earned Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="p-3">{new Date(entry.workDate).toLocaleDateString()}</td>
                      <td className="p-3 font-medium">{entry.hours}</td>
                      <td className="p-3 max-w-xs truncate">{entry.reason || "-"}</td>
                      <td className="p-3">{getStatusBadge(entry.status)}</td>
                      <td className="p-3">
                        {entry.convertedToLeave && entry.earnedLeaveDays ? (
                          <span className="text-green-600 font-medium">
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
        </CardContent>
      </Card>
    </div>
  );
}