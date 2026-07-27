// app/comp-off/page.tsx - COMPLETE ENHANCED VERSION
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
//import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Award, AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp, CalendarDays, Info, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { EnhancedCard } from "@/components/ui/enhanced-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { SectionDivider } from "@/components/ui/section-divider";

interface CompOffCredit {
  id: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: "active" | "expired" | "fully_used" | "pending_approval" | "pending_usage" | "rejected";
  createdAt: string;
  hoursWorked?: number;
}

interface CompOffUsage {
  id: string;
  creditId: string;
  leaveRequestId: string;
  daysUsed: number;
  usedAt: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export default function CompOffPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CompOffCredit[]>([]);
  const [usageHistory, setUsageHistory] = useState<CompOffUsage[]>([]);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CompOffCredit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    alternateFacultyName: "",
    reason: "",
    daysToUse: 1,
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

  // Fetch credits - wrapped in useCallback
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch credits
      const creditsResponse = await fetch("/api/comp-off/credits");
      const creditsData = await creditsResponse.json();
      if (creditsResponse.ok) {
        setCredits(creditsData.credits || []);
      }

      // Fetch usage history
      const usageResponse = await fetch("/api/comp-off/usage-history");
      const usageData = await usageResponse.json();
      if (usageResponse.ok) {
        setUsageHistory(usageData.usage || []);
      }
    } catch (error) {
      console.error("Error fetching comp-off data:", error);
      toast.error("Failed to fetch comp-off data");
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

  const getAvailableDays = (credit: CompOffCredit): number => {
    return credit.creditedDays - credit.usedDays;
  };

  const getDaysUntilExpiry = (expiryDate: string): number => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const openApplyDialog = (credit: CompOffCredit) => {
    setSelectedCredit(credit);
    setFormData({
      startDate: "",
      endDate: "",
      alternateFacultyName: "",
      reason: "",
      daysToUse: 1,
    });
    setShowApplyDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedCredit) return;

    if (!formData.startDate) {
      toast.error("Please select a date");
      return;
    }
    if (!formData.alternateFacultyName.trim()) {
      toast.error("Alternate faculty name is required");
      return;
    }
    if (formData.daysToUse > getAvailableDays(selectedCredit)) {
      toast.error(`You only have ${getAvailableDays(selectedCredit)} day(s) available`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/comp-off/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditId: selectedCredit.id,
          startDate: formData.startDate,
          endDate: formData.endDate || formData.startDate,
          daysToUse: formData.daysToUse,
          alternateFacultyName: formData.alternateFacultyName.trim(),
          reason: formData.reason || `Compensatory off for: ${selectedCredit.reason}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to apply comp-off");
      }

      toast.success(`Comp-off request submitted for ${formData.daysToUse} day(s)`);
      setShowApplyDialog(false);
      setSelectedCredit(null);
      
      await fetchData();
      
      toast.success("📊 Comp-off credits updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to apply";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (credit: CompOffCredit) => {
    const isExpired = new Date(credit.expiryDate) < new Date();
    const availableDays = getAvailableDays(credit);
    
    // Check if credit is actually expired (even if status says active)
    if (isExpired && credit.status === "active") {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    switch (credit.status) {
      case "active":
        if (availableDays <= 0) {
          return <Badge variant="secondary">Fully Used</Badge>;
        }
        const daysUntilExpiry = getDaysUntilExpiry(credit.expiryDate);
        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">Expiring Soon</Badge>;
        }
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">Active</Badge>;
      case "fully_used":
        return <Badge variant="secondary">Fully Used</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "pending_approval":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">Pending Approval</Badge>;
      case "pending_usage":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">Pending Usage</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{credit.status}</Badge>;
    }
  };

  const activeCredits = credits.filter((c) => {
    const isActive = c.status === "active";
    const isNotExpired = new Date(c.expiryDate) >= new Date();
    const hasAvailable = getAvailableDays(c) > 0;
    return isActive && isNotExpired && hasAvailable;
  });
  
  const totalAvailableDays = activeCredits.reduce((sum, c) => sum + getAvailableDays(c), 0);
  
  const expiringCredits = credits.filter((c) => {
    const daysUntilExpiry = getDaysUntilExpiry(c.expiryDate);
    return c.status === "active" && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && getAvailableDays(c) > 0;
  });

  const totalUsedDays = credits.reduce((sum, c) => sum + c.usedDays, 0);
  const totalCreditedDays = credits.reduce((sum, c) => sum + c.creditedDays, 0);
  const utilization = totalCreditedDays > 0 ? (totalUsedDays / totalCreditedDays) * 100 : 0;

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
            <Award className="h-8 w-8 text-primary" />
            Compensatory Off
          </h1>
          <p className="text-muted-foreground mt-1.5 text-base">
            Track and apply for compensatory leave earned from overwork
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/overwork")}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Track Overwork
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          label="Total Available"
          value={`${totalAvailableDays.toFixed(1)} days`}
          icon={<Award className="h-5 w-5" />}
          color="teal"
        />
        <StatCard
          label="Active Credits"
          value={activeCredits.length}
          icon={<CheckCircle className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          label="Used Credits"
          value={credits.filter((c) => c.status === "fully_used").length}
          icon={<TrendingUp className="h-5 w-5" />}
          color="primary"
          trend={{
            value: Math.round(utilization),
            label: "utilization",
            direction: utilization > 80 ? "neutral" : "up"
          }}
        />
        <StatCard
          label="Expiring Soon"
          value={expiringCredits.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="amber"
          trend={{
            value: expiringCredits.length,
            label: "need attention",
            direction: expiringCredits.length > 0 ? "down" : "neutral"
          }}
        />
      </div>

      {/* Expiring Credits Alert */}
      {expiringCredits.length > 0 && (
        <EnhancedCard 
          variant="elevated" 
          accentColor="amber"
          className="mb-6 border-amber-200/50"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-800">⚠️ Credits Expiring Soon</h4>
                <p className="text-sm text-amber-600">
                  You have {expiringCredits.length} credit(s) expiring within 30 days
                </p>
              </div>
            </div>
          }
        >
          <div className="flex flex-wrap gap-3">
            {expiringCredits.map((credit) => (
              <div key={credit.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center gap-3">
                <span className="text-sm font-medium text-amber-800">
                  {getAvailableDays(credit)} days
                </span>
                <span className="text-xs text-amber-600">
                  Expires: {new Date(credit.expiryDate).toLocaleDateString()}
                </span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => openApplyDialog(credit)}
                >
                  Apply Now
                </Button>
              </div>
            ))}
          </div>
        </EnhancedCard>
      )}

      {/* Credits List */}
      <SectionHeader
        title="Your Comp-Off Credits"
        subtitle={`${credits.length} credit${credits.length !== 1 ? "s" : ""} available`}
        icon={<Award className="h-5 w-5" />}
        className="mb-4"
      />

      {credits.length === 0 ? (
        <EnhancedCard 
          variant="elevated"
          padding="lg"
          className="text-center"
        >
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="p-4 rounded-full bg-gray-100">
              <Award className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No comp-off credits available</h3>
            <p className="text-sm text-muted-foreground">Credits are earned from approved overwork hours</p>
            <Button 
              className="mt-2 gap-2" 
              variant="outline" 
              onClick={() => router.push("/overwork")}
            >
              <Clock className="h-4 w-4" />
              Track Overwork
            </Button>
          </div>
        </EnhancedCard>
      ) : (
        <div className="space-y-4">
          {credits.map((credit) => {
            const availableDays = getAvailableDays(credit);
            const daysUntilExpiry = getDaysUntilExpiry(credit.expiryDate);
            const isExpired = credit.status === "expired" || new Date(credit.expiryDate) < new Date();
            const isExpiringSoon = !isExpired && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && credit.status === "active";
            const progress = credit.creditedDays > 0 ? (credit.usedDays / credit.creditedDays) * 100 : 0;
            const isPending = credit.status === "pending_approval" || credit.status === "pending_usage";

            return (
              <EnhancedCard 
                key={credit.id}
                variant="elevated"
                accentColor={
                  isExpired ? "red" :
                  isExpiringSoon ? "amber" :
                  credit.status === "active" ? "teal" :
                  credit.status === "fully_used" ? "none" :
                  isPending ? "blue" :
                  "none"
                }
                className={cn(
                  "transition-all duration-300",
                  isExpired && "opacity-60",
                  isExpiringSoon && "border-amber-300 bg-amber-50/30",
                  credit.status === "active" && !isExpired && "hover:shadow-lg"
                )}
              >
                <div className="flex flex-wrap justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Award
                        className={cn(
                          "h-5 w-5",
                          credit.status === "active" && !isExpired ? "text-teal-600" : "text-gray-400"
                        )}
                      />
                      <h3 className="font-semibold text-gray-900">
                        {credit.creditedDays} Day{credit.creditedDays !== 1 ? "s" : ""} Credit
                      </h3>
                      {getStatusBadge(credit)}
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Reason:</strong> {credit.reason}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-muted-foreground">
                        📅 Earned: {new Date(credit.earnedDate).toLocaleDateString()}
                      </span>
                      <span className={cn(
                        "text-muted-foreground",
                        isExpired && "text-red-600",
                        isExpiringSoon && "text-amber-600 font-medium"
                      )}>
                        ⏰ Expires: {new Date(credit.expiryDate).toLocaleDateString()}
                        {isExpiringSoon && !isExpired && ` (${daysUntilExpiry} days left)`}
                      </span>
                      {credit.hoursWorked && (
                        <span className="text-muted-foreground">
                          ⏱ Hours Worked: {credit.hoursWorked}
                        </span>
                      )}
                    </div>

                    {isPending && (
                      <div className="mt-2 flex items-center gap-1 text-blue-600 text-sm bg-blue-50 p-2 rounded-lg">
                        <Clock className="h-4 w-4" />
                        <span>Awaiting approval</span>
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Usage:</span>
                        <div className="flex-1 max-w-xs bg-gray-200 rounded-full h-2">
                          <div
                            className={cn(
                              "h-2 rounded-full transition-all duration-500",
                              progress > 80 ? "bg-red-500" : "bg-teal-500"
                            )}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="font-medium">
                          {credit.usedDays} / {credit.creditedDays} days
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({availableDays.toFixed(1)} remaining)
                        </span>
                      </div>
                    </div>
                  </div>

                  {credit.status === "active" && !isExpired && availableDays > 0 && (
                    <Button 
                      onClick={() => openApplyDialog(credit)} 
                      className="bg-teal-600 hover:bg-teal-700 shrink-0 gap-2"
                    >
                      Apply for Leave
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </EnhancedCard>
            );
          })}
        </div>
      )}

      {/* Usage History */}
      {usageHistory.length > 0 && (
        <>
          <SectionDivider label="Usage History" variant="gradient" className="my-8" />
          
          <EnhancedCard 
            variant="elevated"
            header={
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Comp Off Usage History</h3>
                  <p className="text-sm text-muted-foreground">Track when you have used comp-off credits</p>
                </div>
              </div>
            }
          >
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground">Date Used</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Days Used</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Reason</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.map((usage) => (
                    <tr key={usage.id} className="border-t hover:bg-gray-50 transition-colors">
                      <td className="p-3">{new Date(usage.usedAt).toLocaleDateString()}</td>
                      <td className="p-3 font-medium">{usage.daysUsed} day(s)</td>
                      <td className="p-3">{usage.reason || "-"}</td>
                      <td className="p-3">
                        {usage.status === "approved" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approved
                          </span>
                        ) : usage.status === "rejected" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </EnhancedCard>
        </>
      )}

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-teal-600" />
              Apply Compensatory Off
            </DialogTitle>
            <DialogDescription>
              {selectedCredit && (
                <>
                  You have <strong>{getAvailableDays(selectedCredit)}</strong> day(s) available from this credit.
                  Credit expires on <strong>{new Date(selectedCredit.expiryDate).toLocaleDateString()}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Days to Use</Label>
              <Input
                type="number"
                min={0.5}
                max={selectedCredit ? getAvailableDays(selectedCredit) : 1}
                step={0.5}
                value={formData.daysToUse}
                onChange={(e) => setFormData({ ...formData, daysToUse: parseFloat(e.target.value) || 0 })}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Max: {selectedCredit ? getAvailableDays(selectedCredit) : 0} days
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate ? format(new Date(formData.startDate), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.startDate ? new Date(formData.startDate) : undefined}
                    onSelect={(date) =>
                      setFormData({ ...formData, startDate: date?.toISOString() || "" })
                    }
                    disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.endDate ? format(new Date(formData.endDate), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.endDate ? new Date(formData.endDate) : undefined}
                    onSelect={(date) =>
                      setFormData({ ...formData, endDate: date?.toISOString() || "" })
                    }
                    disabled={(date: Date) => {
                      if (!formData.startDate) return true;
                      const start = new Date(formData.startDate);
                      return date < start;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alternateFaculty" className="text-sm font-medium">Alternate Faculty Name *</Label>
              <Input
                id="alternateFaculty"
                placeholder="Name of the faculty member covering your duties"
                value={formData.alternateFacultyName}
                onChange={(e) => setFormData({ ...formData, alternateFacultyName: e.target.value })}
                required
                className={cn(
                  formData.alternateFacultyName.trim() && formData.alternateFacultyName.trim().length < 3 && "border-red-300 focus:border-red-500"
                )}
              />
              {formData.alternateFacultyName.trim() && formData.alternateFacultyName.trim().length < 3 && (
                <p className="text-xs text-red-500">Name must be at least 3 characters</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(Optional)</span></Label>
              <Input
                id="reason"
                placeholder="Additional reason for taking comp-off"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  Your comp-off request will be sent for approval. You will be notified once approved.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                !formData.startDate ||
                !formData.alternateFacultyName.trim() ||
                formData.daysToUse <= 0 ||
                !!(selectedCredit && formData.daysToUse > getAvailableDays(selectedCredit))
              }
              className="bg-teal-600 hover:bg-teal-700 gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Submitting...
                </>
              ) : (
                <>
                  Submit Request
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}