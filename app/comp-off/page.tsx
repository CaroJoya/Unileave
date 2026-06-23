// app/comp-off/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Award, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CompOffCredit {
  id: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  expiryDate: string;
  status: "active" | "expired" | "fully_used";
  createdAt: string;
}

interface CompOffUsage {
  id: string;
  creditId: string;
  leaveRequestId: string;
  daysUsed: number;
  usedAt: string;
  reason: string;
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

  // Fetch data when user is available - using a flag to prevent double fetch
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to apply";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const activeCredits = credits.filter((c) => c.status === "active");
  const totalAvailableDays = activeCredits.reduce((sum, c) => sum + getAvailableDays(c), 0);
  const expiringCredits = activeCredits.filter(
    (c) => getDaysUntilExpiry(c.expiryDate) <= 30 && getDaysUntilExpiry(c.expiryDate) > 0
  );

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
        <h1 className="text-3xl font-bold text-gray-900">Compensatory Off</h1>
        <p className="text-muted-foreground mt-2">
          Track and apply for compensatory leave earned from overwork
        </p>
      </div>

      {/* Summary Card */}
      <Card className="mb-8 bg-gradient-to-r from-teal-50 to-emerald-50">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Available Comp-Off Days</p>
              <p className="text-3xl font-bold text-teal-600">{totalAvailableDays.toFixed(1)} days</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Credits</p>
              <p className="text-2xl font-semibold">{activeCredits.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Used Credits</p>
              <p className="text-2xl font-semibold">
                {credits.filter((c) => c.status === "fully_used").length}
              </p>
            </div>
            {expiringCredits.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                <p className="text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {expiringCredits.length} credit(s) expiring in 30 days
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Credits List */}
      <h2 className="text-xl font-semibold mb-4">Your Comp-Off Credits</h2>

      {credits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p>No comp-off credits available</p>
            <p className="text-sm mt-1">Credits are earned from approved overwork hours</p>
            <Button className="mt-4" variant="outline" onClick={() => router.push("/overwork")}>
              Track Overwork
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {credits.map((credit) => {
            const availableDays = getAvailableDays(credit);
            const daysUntilExpiry = getDaysUntilExpiry(credit.expiryDate);
            const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0 && credit.status === "active";
            const isExpired = credit.status === "expired" || daysUntilExpiry <= 0;

            return (
              <Card key={credit.id} className={cn(isExpiringSoon && "border-amber-300 bg-amber-50/30")}>
                <CardContent className="p-6">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Award
                          className={cn(
                            "h-5 w-5",
                            credit.status === "active" ? "text-teal-600" : "text-gray-400"
                          )}
                        />
                        <h3 className="font-semibold">
                          {credit.creditedDays} Day{credit.creditedDays !== 1 ? "s" : ""} Credit
                        </h3>
                        {credit.status === "active" && availableDays > 0 && (
                          <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                            {availableDays.toFixed(1)} Available
                          </span>
                        )}
                        {credit.status === "fully_used" && (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">
                            Fully Used
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                            Expired
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Reason:</strong> {credit.reason}
                      </p>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Earned: {new Date(credit.earnedDate).toLocaleDateString()}
                        </span>
                        <span className="text-muted-foreground">
                          Expires: {new Date(credit.expiryDate).toLocaleDateString()}
                        </span>
                      </div>

                      {isExpiringSoon && !isExpired && (
                        <div className="mt-2 flex items-center gap-1 text-amber-600 text-sm">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Expires in {daysUntilExpiry} days</span>
                        </div>
                      )}

                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Usage:</span>
                          <div className="flex-1 max-w-xs bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-teal-500 h-2 rounded-full transition-all"
                              style={{ width: `${(credit.usedDays / credit.creditedDays) * 100}%` }}
                            />
                          </div>
                          <span className="font-medium">
                            {credit.usedDays} / {credit.creditedDays} days
                          </span>
                        </div>
                      </div>
                    </div>

                    {credit.status === "active" && availableDays > 0 && (
                      <Button onClick={() => openApplyDialog(credit)} className="bg-teal-600 hover:bg-teal-700">
                        Apply for Leave
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Compensatory Off</DialogTitle>
            <DialogDescription>
              {selectedCredit && (
                <>
                  You have {getAvailableDays(selectedCredit)} day(s) available from this credit.
                  Credit expires on {new Date(selectedCredit.expiryDate).toLocaleDateString()}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Days to Use</Label>
              <Input
                type="number"
                min={0.5}
                max={selectedCredit ? getAvailableDays(selectedCredit) : 1}
                step={0.5}
                value={formData.daysToUse}
                onChange={(e) => setFormData({ ...formData, daysToUse: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Max: {selectedCredit ? getAvailableDays(selectedCredit) : 0} days
              </p>
            </div>

            <div className="space-y-2">
              <Label>Start Date *</Label>
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
              <Label>End Date</Label>
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
              <Label htmlFor="alternateFaculty">Alternate Faculty Name *</Label>
              <Input
                id="alternateFaculty"
                placeholder="Name of the faculty member covering your duties"
                value={formData.alternateFacultyName}
                onChange={(e) => setFormData({ ...formData, alternateFacultyName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="Additional reason for taking comp-off"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
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
              className="bg-teal-600 hover:bg-teal-700"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage History */}
      {usageHistory.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Comp Off Usage History</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Date Used</th>
                      <th className="text-left p-3">Days Used</th>
                      <th className="text-left p-3">Reason</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageHistory.map((usage) => (
                      <tr key={usage.id} className="border-t">
                        <td className="p-3">{new Date(usage.usedAt).toLocaleDateString()}</td>
                        <td className="p-3">{usage.daysUsed} day(s)</td>
                        <td className="p-3">{usage.reason || "-"}</td>
                        <td className="p-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Approved
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}