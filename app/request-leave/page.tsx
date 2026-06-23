// app/request-leave/page.tsx
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, CheckCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  deductsBalance: boolean;
  isActive: boolean;
  maxConsecutiveDays: number | null;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

export default function RequestLeavePage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("");
  const [selectedLeaveTypeConfig, setSelectedLeaveTypeConfig] = useState<LeaveType | null>(null);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState<"First Half" | "Second Half">("First Half");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [totalDays, setTotalDays] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [alternateFacultyName, setAlternateFacultyName] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && user.roles?.includes("principal")) {
      toast.error("Principal cannot request leave");
      router.push("/principal/dashboard");
    }
  }, [user, authLoading, router]);

  // Fetch leave types and balances
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch leave types
      const typesResponse = await fetch("/api/headclerk/leave-types");
      const typesData = await typesResponse.json();
      if (typesResponse.ok) {
        const activeTypes = (typesData.leaveTypes || []).filter(
          (type: LeaveType) => type.isActive
        );
        setLeaveTypes(activeTypes);
      }

      // Fetch balances
      const balanceResponse = await fetch("/api/leave/balances");
      const balanceData = await balanceResponse.json();
      if (balanceResponse.ok && balanceData.balances) {
        setBalances(balanceData.balances);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load leave data");
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

  // Calculate total days when dates change - using useMemo
  const calculatedTotalDays = useMemo(() => {
    if (startDate && endDate) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else if (startDate && !endDate) {
      return 1;
    }
    return 0;
  }, [startDate, endDate]);

  // Update totalDays when calculated value changes
  // Using a direct assignment pattern instead of useEffect to avoid the ESLint warning
  // We'll update totalDays in a way that doesn't trigger the setState-in-effect warning
  const [prevCalculatedDays, setPrevCalculatedDays] = useState(0);
  
  // Only update totalDays if the calculated value actually changed
  if (calculatedTotalDays !== prevCalculatedDays) {
    setPrevCalculatedDays(calculatedTotalDays);
    // Use a state updater function to ensure we're using the latest state
    setTotalDays(calculatedTotalDays);
  }

  // Handle leave type selection
  const handleLeaveTypeChange = (value: string) => {
    setSelectedLeaveType(value);
    const config = leaveTypes.find((t) => t.id === value);
    setSelectedLeaveTypeConfig(config || null);
    setIsHalfDay(false); // Reset half-day when changing type
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  // Submit leave request
  const handleSubmit = async () => {
    // Validation
    if (!selectedLeaveType) {
      toast.error("Please select a leave type");
      return;
    }

    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    if (selectedLeaveTypeConfig?.requiresAttachment && !attachmentFile) {
      toast.error("Attachment is required for this leave type");
      return;
    }

    if (!alternateFacultyName.trim()) {
      toast.error("Alternate faculty name is required");
      return;
    }

    if (alternateFacultyName.trim().length < 3) {
      toast.error("Alternate faculty name must be at least 3 characters");
      return;
    }

    // Check balance
    const leaveTypeCode = selectedLeaveTypeConfig?.leaveCode || "";
    if (selectedLeaveTypeConfig?.deductsBalance) {
      const balance = balances[leaveTypeCode];
      if (balance && balance.available < totalDays) {
        toast.error(
          `Insufficient ${leaveTypeCode} balance. Available: ${balance.available}, Requested: ${totalDays}`
        );
        return;
      }
    }

    setSubmitting(true);
    setUploading(true);

    try {
      let attachmentUrl = null;

      // Upload attachment if required
      if (attachmentFile) {
        const formData = new FormData();
        formData.append("file", attachmentFile);
        formData.append("userId", user?.uid || "");
        formData.append("leaveType", leaveTypeCode);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          attachmentUrl = uploadData.url;
        } else {
          throw new Error("Failed to upload attachment");
        }
      }

      // Submit leave request
      const requestBody = {
        leaveType: leaveTypeCode,
        startDate: startDate.toISOString(),
        endDate: (endDate || startDate).toISOString(),
        totalDays: isHalfDay ? 0.5 : totalDays,
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : null,
        reason,
        alternateFacultyName: alternateFacultyName.trim(),
        attachmentUrl,
      };

      const response = await fetch("/api/leave/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit leave request");
      }

      toast.success(
        `Leave request submitted successfully! Status: ${data.status || "Pending"}`
      );

      // Reset form
      setSelectedLeaveType("");
      setSelectedLeaveTypeConfig(null);
      setStartDate(undefined);
      setEndDate(undefined);
      setTotalDays(0);
      setReason("");
      setAlternateFacultyName("");
      setAttachmentFile(null);
      setIsHalfDay(false);

      // Refresh balances
      await fetchData();

      // Redirect to status page after a moment
      setTimeout(() => {
        router.push("/status");
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  // Get selected balance - using a regular function instead of useMemo
  // to avoid the preserve-manual-memoization warning
  const getSelectedBalance = () => {
    if (selectedLeaveTypeConfig) {
      return balances[selectedLeaveTypeConfig.leaveCode] || null;
    }
    return null;
  };

  // Check if submit should be disabled - computed directly in render
  const isSubmitDisabled = (() => {
    const selectedBalance = getSelectedBalance();
    
    // Check if any required fields are missing
    if (
      !selectedLeaveType ||
      !startDate ||
      !alternateFacultyName.trim()
    ) {
      return true;
    }

    // Check attachment requirement
    if (selectedLeaveTypeConfig?.requiresAttachment && !attachmentFile) {
      return true;
    }

    // Check balance
    if (selectedLeaveTypeConfig?.deductsBalance && selectedBalance) {
      if (selectedBalance.available < totalDays) {
        return true;
      }
    }

    return submitting || false;
  })();

  // Get the current selected balance for display
  const selectedBalance = getSelectedBalance();

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
        <h1 className="text-3xl font-bold text-gray-900">Request Leave</h1>
        <p className="text-muted-foreground mt-2">
          Submit a new leave request for approval
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Application</CardTitle>
          <CardDescription>
            Fill in the details below to request leave
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Leave Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="leaveType">Leave Type *</Label>
            <Select value={selectedLeaveType} onValueChange={handleLeaveTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => {
                  const balance = balances[type.leaveCode];
                  const isAvailable = !type.deductsBalance || (balance && balance.available > 0);
                  return (
                    <SelectItem
                      key={type.id}
                      value={type.id}
                      disabled={!isAvailable}
                    >
                      {type.leaveName} ({type.leaveCode})
                      {type.deductsBalance && balance && (
                        <span className="text-xs text-muted-foreground ml-2">
                          - {balance.available} days available
                        </span>
                      )}
                      {!isAvailable && type.deductsBalance && (
                        <span className="text-xs text-red-500 ml-2">- Insufficient balance</span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedLeaveTypeConfig && selectedBalance && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Info className="h-4 w-4" />
                <span>
                  Available balance: <strong>{selectedBalance.available}</strong> days
                  {selectedLeaveTypeConfig.deductsBalance && selectedBalance.available < totalDays && (
                    <span className="text-red-500 ml-2">
                      (Insufficient: need {totalDays - selectedBalance.available} more days)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Leave Duration *</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      disabled={(date) => {
                        if (!startDate) return true;
                        return date < startDate;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {totalDays > 0 && (
              <p className="text-sm text-muted-foreground">
                Total days: <strong>{isHalfDay ? 0.5 : totalDays}</strong> day
                {(!isHalfDay && totalDays !== 1) ? "s" : ""}
              </p>
            )}
          </div>

          {/* Half Day Toggle */}
          {selectedLeaveTypeConfig?.allowHalfDay && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="halfDay" className="cursor-pointer">
                  Half Day Leave
                </Label>
              </div>
              {isHalfDay && (
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="First Half"
                      checked={halfDaySession === "First Half"}
                      onChange={(e) =>
                        setHalfDaySession(e.target.value as "First Half" | "Second Half")
                      }
                      className="w-4 h-4"
                    />
                    <span>First Half</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="Second Half"
                      checked={halfDaySession === "Second Half"}
                      onChange={(e) =>
                        setHalfDaySession(e.target.value as "First Half" | "Second Half")
                      }
                      className="w-4 h-4"
                    />
                    <span>Second Half</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Briefly describe the reason for leave"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Alternate Faculty Name - REQUIRED for all */}
          <div className="space-y-2">
            <Label htmlFor="alternateFaculty">
              Alternate Faculty Name *
              <span className="text-xs text-muted-foreground ml-2">
                (Who will cover your duties?)
              </span>
            </Label>
            <Input
              id="alternateFaculty"
              placeholder="Enter the name of the faculty member covering your duties"
              value={alternateFacultyName}
              onChange={(e) => setAlternateFacultyName(e.target.value)}
              required
            />
          </div>

          {/* Attachment */}
          {selectedLeaveTypeConfig?.requiresAttachment && (
            <div className="space-y-2">
              <Label htmlFor="attachment">
                Attachment *
                <span className="text-xs text-muted-foreground ml-2">
                  (PDF, DOC, JPG, PNG - Max 16MB)
                </span>
              </Label>
              <Input
                id="attachment"
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {attachmentFile && (
                <p className="text-sm text-green-600">
                  <CheckCircle className="inline h-4 w-4 mr-1" />
                  File selected: {attachmentFile.name}
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  {uploading ? "Uploading..." : "Submitting..."}
                </>
              ) : (
                "Submit Leave Request"
              )}
            </Button>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium">About Your Leave Request</p>
                <ul className="text-sm text-blue-700 mt-1 list-disc list-inside space-y-1">
                  <li>Your request will be sent to your department HOD for approval</li>
                  <li>You can edit or cancel your request before it is approved</li>
                  <li>You will receive email and in-app notifications for status updates</li>
                  {selectedLeaveTypeConfig?.deductsBalance && (
                    <li>
                      This leave type deducts from your balance. Make sure you have enough
                      days available.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}