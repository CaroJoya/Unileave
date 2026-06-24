// app/vacation/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Sun, Snowflake, AlertCircle, Info, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VacationPeriod {
  id: string;
  vacationType: "Summer Vacation" | "Winter Vacation";
  year: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  paidLeaveQuota: number;
  isActive: boolean;
}

interface VacationRequest {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  paidDays: number;
  unpaidDays: number;
  vacationType: string;
  status: string;
  reason: string;
  createdAt: string;
}

export default function VacationPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [history, setHistory] = useState<VacationRequest[]>([]);
  const [selectedVacation, setSelectedVacation] = useState<VacationPeriod | null>(null);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    alternateFacultyName: "",
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
      // Fetch vacation periods
      const periodsRes = await fetch("/api/headclerk/vacation-periods");
      const periodsData = await periodsRes.json();
      if (periodsRes.ok) {
        const activeVacations = (periodsData.vacations || []).filter(
          (v: VacationPeriod) => v.isActive
        );
        setVacations(activeVacations);
      }

      // Fetch vacation history
      const historyRes = await fetch("/api/leave/my-requests?leaveType=VL");
      const historyData = await historyRes.json();
      if (historyRes.ok) {
        setHistory(historyData.requests || []);
      }
    } catch (error) {
      console.error("Error fetching vacation data:", error);
      toast.error("Failed to fetch vacation data");
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

  // Calculate vacation days using useMemo instead of useEffect
  const calculation = useMemo(() => {
    if (!selectedVacation || !formData.startDate || !formData.endDate) {
      return null;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const vacationStart = new Date(selectedVacation.startDate);
    const vacationEnd = new Date(selectedVacation.endDate);

    // Validate dates are within vacation period
    if (start < vacationStart || end > vacationEnd) {
      return {
        totalDays: 0,
        paidDays: 0,
        unpaidDays: 0,
        isValid: false,
        error: "Selected dates must be within the vacation period",
      };
    }

    if (start > end) {
      return {
        totalDays: 0,
        paidDays: 0,
        unpaidDays: 0,
        isValid: false,
        error: "Start date must be before end date",
      };
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const paidDays = Math.min(totalDays, selectedVacation.paidLeaveQuota);
    const unpaidDays = totalDays - paidDays;

    return {
      totalDays,
      paidDays,
      unpaidDays,
      isValid: true,
    };
  }, [selectedVacation, formData.startDate, formData.endDate]);

  const handleVacationChange = (vacationId: string) => {
    const vacation = vacations.find((v) => v.id === vacationId);
    setSelectedVacation(vacation || null);
    setFormData({
      startDate: "",
      endDate: "",
      alternateFacultyName: "",
      reason: "",
    });
  };

  const handleSubmit = async () => {
    if (!selectedVacation) {
      toast.error("Please select a vacation period");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    if (!formData.alternateFacultyName.trim()) {
      toast.error("Alternate faculty name is required");
      return;
    }

    if (!calculation?.isValid) {
      toast.error(calculation?.error || "Invalid date selection");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/leave/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveType: "VL",
          startDate: formData.startDate,
          endDate: formData.endDate,
          totalDays: calculation.totalDays,
          isHalfDay: false,
          halfDaySession: null,
          reason: formData.reason || `Vacation request for ${selectedVacation.vacationType}`,
          alternateFacultyName: formData.alternateFacultyName.trim(),
          attachmentUrl: null,
          vacationDetails: {
            vacationId: selectedVacation.id,
            vacationType: selectedVacation.vacationType,
            paidDays: calculation.paidDays,
            unpaidDays: calculation.unpaidDays,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit vacation request");
      }

      toast.success(
        `Vacation request submitted! Paid: ${calculation.paidDays} days, Unpaid: ${calculation.unpaidDays} days`
      );

      setSelectedVacation(null);
      setFormData({
        startDate: "",
        endDate: "",
        alternateFacultyName: "",
        reason: "",
      });
      await fetchData();

      // ✅ SMART REDIRECT: Go to status page to see the vacation request
      toast.success("🎯 Redirecting to your vacation status...");
      setTimeout(() => {
        router.push("/status");
      }, 1200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getVacationIcon = (type: string) => {
    if (type === "Summer Vacation") {
      return <Sun className="h-5 w-5 text-yellow-500" />;
    }
    return <Snowflake className="h-5 w-5 text-blue-500" />;
  };

  const isDateDisabled = (date: Date, vacation: VacationPeriod | null): boolean => {
    if (!vacation) return true;
    const vacationStart = new Date(vacation.startDate);
    const vacationEnd = new Date(vacation.endDate);
    return date < vacationStart || date > vacationEnd;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </span>
        );
      case "Rejected_HOD":
      case "Rejected_Registrar":
      case "Rejected_Principal":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </span>
        );
      case "Pending_Revision":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Needs Revision
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
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Vacation Leave</h1>
        <p className="text-muted-foreground mt-2">
          Apply for paid vacation during Summer or Winter breaks
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-8 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-800 font-medium">About Vacation Leave</p>
              <p className="text-sm text-blue-700 mt-1">
                Summer Vacation: 40 days total, up to 27 paid days. Winter Vacation: 40 days total,
                up to 21 paid days. Any days beyond the paid quota will be treated as unpaid leave.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Vacation Periods */}
      {vacations.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Active Vacation Periods</CardTitle>
            <CardDescription>Select the vacation period you want to apply for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {vacations.map((vacation) => (
                <div
                  key={vacation.id}
                  className={cn(
                    "p-4 rounded-lg border-2 cursor-pointer transition-all",
                    selectedVacation?.id === vacation.id
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => handleVacationChange(vacation.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleVacationChange(vacation.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getVacationIcon(vacation.vacationType)}
                    <h3 className="font-semibold">{vacation.vacationType} {vacation.year}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(vacation.startDate).toLocaleDateString()} -{" "}
                    {new Date(vacation.endDate).toLocaleDateString()}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>Total: <strong>{vacation.totalDays} days</strong></span>
                    <span>Paid Quota: <strong>{vacation.paidLeaveQuota} days</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application Form */}
      {selectedVacation && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Vacation Application</CardTitle>
            <CardDescription>
              Apply for {selectedVacation.vacationType} {selectedVacation.year}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Selection */}
            <div className="grid gap-4 md:grid-cols-2">
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
                      {formData.startDate ? format(new Date(formData.startDate), "PPP") : "Pick start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.startDate ? new Date(formData.startDate) : undefined}
                      onSelect={(date) =>
                        setFormData({ ...formData, startDate: date?.toISOString() || "" })
                      }
                      disabled={(date: Date) => isDateDisabled(date, selectedVacation)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date *</Label>
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
                      {formData.endDate ? format(new Date(formData.endDate), "PPP") : "Pick end date"}
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
                        if (isDateDisabled(date, selectedVacation)) return true;
                        const start = formData.startDate ? new Date(formData.startDate) : null;
                        if (start && date < start) return true;
                        return false;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Calculation Result */}
            {calculation && (
              <div
                className={cn(
                  "p-4 rounded-lg",
                  calculation.isValid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                )}
              >
                {calculation.isValid ? (
                  <>
                    <p className="font-medium text-green-800 mb-2">Leave Calculation</p>
                    <div className="space-y-1 text-sm">
                      <p>Total days requested: <strong>{calculation.totalDays} days</strong></p>
                      <p>Paid days (within quota): <strong className="text-green-600">{calculation.paidDays} days</strong></p>
                      {calculation.unpaidDays > 0 && (
                        <p>Unpaid days (exceeds quota): <strong className="text-amber-600">{calculation.unpaidDays} days</strong></p>
                      )}
                    </div>
                    {calculation.unpaidDays === 0 && (
                      <p className="text-xs text-green-700 mt-2">
                        ✓ Within paid leave quota. No deduction from salary.
                      </p>
                    )}
                    {calculation.unpaidDays > 0 && (
                      <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {calculation.unpaidDays} day(s) will be treated as unpaid leave.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-red-700 text-sm">{calculation.error}</p>
                )}
              </div>
            )}

            {/* Alternate Faculty */}
            <div className="space-y-2">
              <Label htmlFor="alternateFaculty">Alternate Faculty Name *</Label>
              <Input
                id="alternateFaculty"
                placeholder="Name of the faculty member covering your duties during vacation"
                value={formData.alternateFacultyName}
                onChange={(e) => setFormData({ ...formData, alternateFacultyName: e.target.value })}
                required
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Additional Comments (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Any additional information about your vacation request"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedVacation(null);
                  setFormData({
                    startDate: "",
                    endDate: "",
                    alternateFacultyName: "",
                    reason: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !calculation?.isValid}
                className="flex-1"
              >
                {submitting ? "Submitting..." : "Submit Vacation Request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {vacations.length === 0 && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p>No active vacation periods available</p>
            <p className="text-sm mt-1">Please check back during vacation season</p>
          </CardContent>
        </Card>
      )}

      {/* Vacation History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vacation History</CardTitle>
            <CardDescription>Your past and current vacation requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Period</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-left p-3">Total Days</th>
                    <th className="text-left p-3">Paid/Unpaid</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((request) => (
                    <tr key={request.id} className="border-t">
                      <td className="p-3">
                        {new Date(request.startDate).toLocaleDateString()} -{" "}
                        {new Date(request.endDate).toLocaleDateString()}
                      </td>
                      <td className="p-3">{request.vacationType || "Vacation"}</td>
                      <td className="p-3 font-medium">{request.totalDays} days</td>
                      <td className="p-3">
                        <span className="text-green-600">{request.paidDays} paid</span>
                        {request.unpaidDays > 0 && (
                          <span className="text-amber-600 ml-2">{request.unpaidDays} unpaid</span>
                        )}
                      </td>
                      <td className="p-3">{getStatusBadge(request.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}