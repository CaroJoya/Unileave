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

// Import Textarea directly - this should work after creating the file
import { Textarea } from "@/components/ui/textarea";

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

export default function CompOffPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CompOffCredit[]>([]);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CompOffCredit | null>(null);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    alternateFacultyName: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch credits - wrapped in useCallback
  const fetchCredits = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/comp-off/credits");
      const data = await response.json();
      if (response.ok) {
        setCredits(data.credits || []);
      } else {
        toast.error(data.error || "Failed to fetch comp-off credits");
      }
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast.error("Failed to fetch comp-off credits");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch credits when user is available
  useEffect(() => {
    if (user) {
      fetchCredits();
    }
  }, [user, fetchCredits]);

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
    });
    setShowApplyDialog(true);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setFormData({ ...formData, startDate: date?.toISOString() || "" });
  };

  const handleAlternateFacultyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, alternateFacultyName: e.target.value });
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({ ...formData, reason: e.target.value });
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
    
    setSubmitting(true);
    try {
      const response = await fetch("/api/comp-off/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditId: selectedCredit.id,
          startDate: formData.startDate,
          endDate: formData.endDate || formData.startDate,
          totalDays: 1,
          alternateFacultyName: formData.alternateFacultyName,
          reason: formData.reason || `Compensatory off for: ${selectedCredit.reason}`,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to apply comp-off");
      }
      
      toast.success("Comp-off request submitted successfully");
      setShowApplyDialog(false);
      setSelectedCredit(null);
      fetchCredits();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to apply";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const activeCredits = credits.filter(c => c.status === "active");
  const totalAvailableDays = activeCredits.reduce((sum, c) => sum + getAvailableDays(c), 0);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
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
      <Card className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Available Comp-Off Days</p>
              <p className="text-3xl font-bold text-primary">{totalAvailableDays} days</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Credits</p>
              <p className="text-2xl font-semibold">{activeCredits.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Used Credits</p>
              <p className="text-2xl font-semibold">{credits.filter(c => c.status === "fully_used").length}</p>
            </div>
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
                        <Award className={cn(
                          "h-5 w-5",
                          credit.status === "active" ? "text-green-600" : "text-gray-400"
                        )} />
                        <h3 className="font-semibold">
                          {credit.creditedDays} Day{credit.creditedDays !== 1 ? "s" : ""} Credit
                        </h3>
                        {credit.status === "active" && availableDays > 0 && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            Available
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
                              className="bg-primary h-2 rounded-full"
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
                      <Button onClick={() => openApplyDialog(credit)}>
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
              <Label>Select Date *</Label>
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
                    onSelect={handleDateSelect}
                    disabled={(date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
                onChange={handleAlternateFacultyChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Additional reason for taking comp-off"
                value={formData.reason}
                onChange={handleReasonChange}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}