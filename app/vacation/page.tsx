import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, Sun, Snowflake, AlertCircle, Info, CheckCircle, XCircle, Clock, Umbrella, CalendarDays, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EnhancedCard } from "@/components/ui/enhanced-card";
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
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </span>
        );
      case "Rejected_HOD":
      case "Rejected_Registrar":
      case "Rejected_Principal":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </span>
        );
      case "Pending_Revision":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Needs Revision
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

  const totalHistoryDays = history.reduce((sum, r) => sum + r.totalDays, 0);
  const totalPaidDays = history.reduce((sum, r) => sum + (r.paidDays || 0), 0);
  const totalUnpaidDays = history.reduce((sum, r) => sum + (r.unpaidDays || 0), 0);

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Umbrella className="h-8 w-8 text-primary" />
            Vacation Leave
          </h1>
          <p className="text-muted-foreground mt-1.5 text-base">
            Apply for paid vacation during Summer or Winter breaks
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/status")}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          View Status
        </Button>
      </div>

      {/* Info Card */}
      <EnhancedCard 
        variant="elevated" 
        accentColor="blue"
        className="mb-8"
        header={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">About Vacation Leave</h3>
              <p className="text-sm text-muted-foreground">Understand how vacation leave works</p>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-800 font-medium">
              <Sun className="h-4 w-4" />
              Summer Vacation
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              40 days total, up to <strong>27 paid days</strong>
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-blue-800 font-medium">
              <Snowflake className="h-4 w-4" />
              Winter Vacation
            </div>
            <p className="text-sm text-blue-700 mt-1">
              40 days total, up to <strong>21 paid days</strong>
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Any days beyond the paid quota will be treated as unpaid leave.
        </p>
      </EnhancedCard>

      {/* Active Vacation Periods */}
      {vacations.length > 0 && (
        <EnhancedCard 
          variant="elevated"
          className="mb-8"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Active Vacation Periods</h3>
                <p className="text-sm text-muted-foreground">Select the vacation period you want to apply for</p>
              </div>
            </div>
          }
        >
          <div className="grid gap-3">
            {vacations.map((vacation) => (
              <div
                key={vacation.id}
                className={cn(
                  "p-4 rounded-xl border-2 cursor-pointer transition-all duration-300",
                  selectedVacation?.id === vacation.id
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
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
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    vacation.vacationType === "Summer Vacation" ? "bg-yellow-100" : "bg-blue-100"
                  )}>
                    {getVacationIcon(vacation.vacationType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900">
                        {vacation.vacationType} {vacation.year}
                      </h4>
                      {selectedVacation?.id === vacation.id && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(vacation.startDate).toLocaleDateString()} — {new Date(vacation.endDate).toLocaleDateString()}
                    </p>
                    <div className="flex gap-4 mt-1 text-sm">
                      <span>Total: <strong>{vacation.totalDays} days</strong></span>
                      <span>Paid Quota: <strong>{vacation.paidLeaveQuota} days</strong></span>
                    </div>
                  </div>
                  {vacation.vacationType === "Summer Vacation" ? (
                    <Sun className="h-6 w-6 text-yellow-500 opacity-40" />
                  ) : (
                    <Snowflake className="h-6 w-6 text-blue-500 opacity-40" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </EnhancedCard>
      )}

      {/* Application Form */}
      {selectedVacation && (
        <EnhancedCard 
          variant="elevated"
          accentColor={selectedVacation.vacationType === "Summer Vacation" ? "amber" : "blue"}
          className="mb-8"
          header={
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                selectedVacation.vacationType === "Summer Vacation" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"
              )}>
                {getVacationIcon(selectedVacation.vacationType)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedVacation.vacationType} {selectedVacation.year}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedVacation.startDate).toLocaleDateString()} — {new Date(selectedVacation.endDate).toLocaleDateString()}
                </p>
              </div>
              <div className="ml-auto text-sm text-muted-foreground">
                <span className="font-medium">{selectedVacation.paidLeaveQuota}</span> paid days available
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Date Selection */}
            <div className="grid gap-4 md:grid-cols-2">
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
                <Label className="text-sm font-medium">End Date *</Label>
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
                  "p-4 rounded-xl transition-all duration-300",
                  calculation.isValid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                )}
              >
                {calculation.isValid ? (
                  <div>
                    <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                      <CheckCircle className="h-5 w-5" />
                      Leave Calculation
                    </div>
                    <div className="grid gap-1 text-sm md:grid-cols-3">
                      <div className="p-2 bg-white/50 rounded-lg text-center">
                        <span className="text-muted-foreground">Total Days</span>
                        <p className="text-lg font-bold text-gray-900">{calculation.totalDays} days</p>
                      </div>
                      <div className="p-2 bg-white/50 rounded-lg text-center">
                        <span className="text-muted-foreground">Paid Days</span>
                        <p className="text-lg font-bold text-green-600">{calculation.paidDays} days</p>
                      </div>
                      <div className="p-2 bg-white/50 rounded-lg text-center">
                        <span className="text-muted-foreground">Unpaid Days</span>
                        <p className={cn(
                          "text-lg font-bold",
                          calculation.unpaidDays > 0 ? "text-amber-600" : "text-green-600"
                        )}>
                          {calculation.unpaidDays} days
                        </p>
                      </div>
                    </div>
                    {calculation.unpaidDays === 0 && (
                      <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Within paid leave quota. No deduction from salary.
                      </p>
                    )}
                    {calculation.unpaidDays > 0 && (
                      <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {calculation.unpaidDays} day(s) will be treated as unpaid leave.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {calculation.error}
                  </p>
                )}
              </div>
            )}

            {/* Alternate Faculty */}
            <div className="space-y-2">
              <Label htmlFor="alternateFaculty" className="text-sm font-medium">
                Alternate Faculty Name *
                <span className="text-xs text-muted-foreground ml-2 font-normal">
                  (Who will cover your duties during vacation?)
                </span>
              </Label>
              <Input
                id="alternateFaculty"
                placeholder="Name of the faculty member covering your duties during vacation"
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

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">Additional Comments <span className="text-muted-foreground font-normal">(Optional)</span></Label>
              <Textarea
                id="reason"
                placeholder="Any additional information about your vacation request"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-2">
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
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !calculation?.isValid}
                className="flex-[2] gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Vacation Request
                    <CalendarDays className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </EnhancedCard>
      )}

      {/* No Active Vacations */}
      {vacations.length === 0 && (
        <EnhancedCard 
          variant="elevated"
          padding="lg"
          className="text-center"
        >
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="p-4 rounded-full bg-gray-100">
              <CalendarDays className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Active Vacation Periods</h3>
            <p className="text-sm text-muted-foreground">Please check back during vacation season</p>
          </div>
        </EnhancedCard>
      )}

      {/* Vacation History */}
      {history.length > 0 && (
        <EnhancedCard 
          variant="elevated"
          className="mt-8"
          header={
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Vacation History</h3>
                <p className="text-sm text-muted-foreground">Your past and current vacation requests</p>
              </div>
              <div className="ml-auto flex gap-3 text-sm">
                <span className="text-muted-foreground">Total: <strong className="text-gray-900">{totalHistoryDays} days</strong></span>
                <span className="text-green-600">Paid: <strong>{totalPaidDays} days</strong></span>
                {totalUnpaidDays > 0 && (
                  <span className="text-amber-600">Unpaid: <strong>{totalUnpaidDays} days</strong></span>
                )}
              </div>
            </div>
          }
        >
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Total Days</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Paid/Unpaid</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((request) => (
                  <tr key={request.id} className="border-t hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      {new Date(request.startDate).toLocaleDateString()} — {new Date(request.endDate).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        request.vacationType === "Summer Vacation" ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"
                      )}>
                        {request.vacationType === "Summer Vacation" ? <Sun className="h-3 w-3" /> : <Snowflake className="h-3 w-3" />}
                        {request.vacationType || "Vacation"}
                      </span>
                    </td>
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
        </EnhancedCard>
      )}
    </div>
  );
}