"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, TrendingUp } from "lucide-react";

interface OverworkEntry {
  id: string;
  hours: number;
  workDate: string;
  reason: string;
  status: string;
  convertedToLeave: boolean;
  earnedLeaveDays: number | null;
  createdAt: string;
}

interface OverworkConfig {
  conversionHours: number;
  minHoursPerEntry: number;
  maxHoursPerDay: number;
}

export default function OverworkPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const [entries, setEntries] = useState<OverworkEntry[]>([]);
  const [config, setConfig] = useState<OverworkConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    workDate: "",
    hours: "",
    reason: "",
  });

  // ========== DECLARE fetchConfig FIRST with useCallback ==========
  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/headclerk/overwork-config");
      const data = await response.json();
      if (data.config) {
        setConfig({
          conversionHours: data.config.conversionHours || 5,
          minHoursPerEntry: data.config.minHoursPerEntry || 0.5,
          maxHoursPerDay: data.config.maxHoursPerDay || 24,
        });
      }
    } catch (error) {
      console.error("Failed to fetch overwork config:", error);
    }
  }, []);

  // ========== DECLARE fetchData SECOND with useCallback ==========
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/overwork/my-history");
      const data = await response.json();
      if (response.ok) {
        setEntries(data.entries || []);
      }
    } catch (error) {
      console.error("Failed to fetch overwork entries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ========== DECLARE handleSubmit THIRD ==========
  const handleSubmit = useCallback(async () => {
    if (!formData.workDate) {
      toast.error("Please select a date");
      return;
    }
    if (!formData.hours) {
      toast.error("Please enter hours");
      return;
    }

    const hours = parseFloat(formData.hours);
    if (config) {
      if (hours < config.minHoursPerEntry) {
        toast.error(`Minimum hours per entry is ${config.minHoursPerEntry}`);
        return;
      }
      if (hours > config.maxHoursPerDay) {
        toast.error(`Maximum hours per day is ${config.maxHoursPerDay}`);
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
      fetchData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [formData, config, fetchData]);

  // ========== NOW useEffect can safely call them ==========
  useEffect(() => {
    if (!user && !isLoading) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchData();
      fetchConfig();
    }
  }, [user, isLoading, router, fetchData, fetchConfig]);

  // Calculate summary
  const totalHours = entries.reduce((sum, e) => sum + (e.status === "approved" ? e.hours : 0), 0);
  const pendingHours = entries.reduce((sum, e) => sum + (e.status === "pending" ? e.hours : 0), 0);
  const earnedLeaves = Math.floor(totalHours / (config?.conversionHours || 5));
  const progressToNext = (totalHours % (config?.conversionHours || 5)) / (config?.conversionHours || 5) * 100;

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
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
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Hours</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingHours.toFixed(1)}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Earned Leaves</p>
              <p className="text-2xl font-bold text-green-600">{earnedLeaves}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Every {config?.conversionHours} hours = 1 day
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {config && totalHours > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress to next leave day</span>
                <span>{progressToNext.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {(totalHours % (config.conversionHours || 5)).toFixed(1)} / {config.conversionHours} hours
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
            Record extra work hours for approval
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
                  min={config?.minHoursPerEntry || 0.5}
                  max={config?.maxHoursPerDay || 24}
                  placeholder="e.g., 5"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  required
                />
                {config && (
                  <p className="text-xs text-muted-foreground">
                    Min: {config.minHoursPerEntry} | Max: {config.maxHoursPerDay} hours/day
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                placeholder="e.g., Exam duty on Sunday"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "Submitting..." : "Submit Overwork"}
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
              No overwork entries found. Submit your first entry above.
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
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="p-3">{new Date(entry.workDate).toLocaleDateString()}</td>
                      <td className="p-3">{entry.hours}</td>
                      <td className="p-3">{entry.reason || "-"}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            entry.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : entry.status === "rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {entry.status === "approved" && "Approved"}
                          {entry.status === "rejected" && "Rejected"}
                          {entry.status === "pending" && "Pending"}
                        </span>
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