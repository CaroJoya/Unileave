"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarIcon, CheckCircle, Info, Briefcase, MapPin, FileText, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EnhancedCard } from "@/components/ui/enhanced-card";
interface LeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  deductsBalance: boolean;
  isActive: boolean;
  maxConsecutiveDays: number | null;
  requiresEventDetails?: boolean;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

interface ODDetails {
  eventName: string;
  organization: string;
  location: string;
  purpose: string;
}

export default function RequestLeavePage() {
  const { user, isLoading: authLoading, hydrationComplete } = useAuthStore();
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
  
  // OD specific state
  const [odDetails, setOdDetails] = useState<ODDetails>({
    eventName: "",
    organization: "",
    location: "",
    purpose: "",
  });

  // Auth check
  useEffect(() => {
    if (!hydrationComplete) return;
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && user.roles?.includes("principal")) {
      toast.error("Principal cannot request leave");
      router.push("/principal/dashboard");
    }
  }, [user, authLoading, router, hydrationComplete]);

  // Fetch leave types and balances
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const typesResponse = await fetch("/api/leave-types");
      const typesData = await typesResponse.json();
      if (typesResponse.ok) {
        const activeTypes = (typesData.leaveTypes || []).filter(
          (type: LeaveType) => type.isActive
        );
        setLeaveTypes(activeTypes);
      } else {
        console.error("Failed to fetch leave types:", typesData.error);
      }

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

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (hydrationComplete && user && !user.roles?.includes("principal") && isMounted) {
        await fetchData();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user, fetchData, hydrationComplete]);

  const calculatedTotalDays = useMemo(() => {
    if (isHalfDay) {
      return 0.5;
    }
    
    if (startDate && endDate) {
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } else if (startDate && !endDate) {
      return 1;
    }
    return 0;
  }, [startDate, endDate, isHalfDay]);

  const [prevCalculatedDays, setPrevCalculatedDays] = useState(0);
  
  if (calculatedTotalDays !== prevCalculatedDays) {
    setPrevCalculatedDays(calculatedTotalDays);
    setTotalDays(calculatedTotalDays);
  }

  const handleLeaveTypeChange = (value: string) => {
    setSelectedLeaveType(value);
    const config = leaveTypes.find((t) => t.id === value);
    setSelectedLeaveTypeConfig(config || null);
    setIsHalfDay(false);
    setEndDate(undefined);
    
    const requiresEventDetails = config?.requiresEventDetails || (config?.leaveCode === 'OD');
    
    // Clear OD details when switching away from OD
    if (!requiresEventDetails) {
      setOdDetails({
        eventName: "",
        organization: "",
        location: "",
        purpose: "",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    toast.dismiss();

    if (!selectedLeaveType) {
      toast.error("Please select a leave type");
      return;
    }

    if (!startDate) {
      toast.error("Please select a start date");
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

    const isOD = selectedLeaveTypeConfig?.leaveCode === "OD";

    // OD: Validate event details
    if (isOD) {
      if (!odDetails.eventName.trim() || odDetails.eventName.trim().length < 3) {
        toast.error("Event name is required (minimum 3 characters)");
        return;
      }
      if (!odDetails.organization.trim() || odDetails.organization.trim().length < 2) {
        toast.error("Organization name is required");
        return;
      }
      if (!odDetails.location.trim() || odDetails.location.trim().length < 2) {
        toast.error("Location is required");
        return;
      }
      if (!odDetails.purpose.trim() || odDetails.purpose.trim().length < 5) {
        toast.error("Purpose description is required (minimum 5 characters)");
        return;
      }
    }

    // Attachment validation
    if ((isOD || selectedLeaveTypeConfig?.requiresAttachment) && !attachmentFile) {
      toast.error("Attachment is required for this leave type");
      return;
    }

    const leaveTypeCode = selectedLeaveTypeConfig?.leaveCode || "";
    
    // Balance check - Skip for OD
    if (!isOD && selectedLeaveTypeConfig?.deductsBalance && leaveTypeCode !== 'CO') {
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

      const requestBody: {
        leaveType: string;
        startDate: string;
        endDate: string;
        totalDays: number;
        isHalfDay: boolean;
        halfDaySession: string | null;
        reason: string;
        alternateFacultyName: string;
        attachmentUrl: string | null;
        odDetails?: ODDetails;
      } = {
        leaveType: leaveTypeCode,
        startDate: startDate.toISOString(),
        endDate: (endDate || startDate).toISOString(),
        totalDays: isHalfDay ? 0.5 : totalDays,
        isHalfDay,
        halfDaySession: isHalfDay ? halfDaySession : null,
        reason: reason || "",
        alternateFacultyName: alternateFacultyName.trim(),
        attachmentUrl,
      };

      if (isOD) {
        requestBody.odDetails = odDetails;
      }

      console.log("📤 Submitting leave request:", requestBody);

      const response = await fetch("/api/leave/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.field) {
          toast.error(`${data.field}: ${data.error}`);
        } else {
          throw new Error(data.error || "Failed to submit leave request");
        }
        return;
      }

      const leaveTypeLabel = isOD ? "On Duty" : (selectedLeaveTypeConfig?.leaveName || leaveTypeCode);
      toast.success(
        `✅ ${leaveTypeLabel} request submitted successfully!${isOD ? " (No balance deducted)" : ""}`
      );

      setSelectedLeaveType("");
      setSelectedLeaveTypeConfig(null);
      setStartDate(undefined);
      setEndDate(undefined);
      setTotalDays(0);
      setReason("");
      setAlternateFacultyName("");
      setAttachmentFile(null);
      setIsHalfDay(false);
      setOdDetails({
        eventName: "",
        organization: "",
        location: "",
        purpose: "",
      });

      await fetchData();

      toast.success("🎯 Redirecting to your leave status page...");
      setTimeout(() => {
        router.push("/status");
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const getSelectedBalance = () => {
    if (selectedLeaveTypeConfig) {
      return balances[selectedLeaveTypeConfig.leaveCode] || null;
    }
    return null;
  };

  const isSubmitDisabled = (() => {
    const selectedBalance = getSelectedBalance();
    const isOD = selectedLeaveTypeConfig?.leaveCode === "OD";
    
    if (
      !selectedLeaveType ||
      !startDate ||
      !alternateFacultyName.trim()
    ) {
      return true;
    }

    if (isOD) {
      if (!odDetails.eventName.trim() || odDetails.eventName.trim().length < 3) return true;
      if (!odDetails.organization.trim() || odDetails.organization.trim().length < 2) return true;
      if (!odDetails.location.trim() || odDetails.location.trim().length < 2) return true;
      if (!odDetails.purpose.trim() || odDetails.purpose.trim().length < 5) return true;
    }

    if ((isOD || selectedLeaveTypeConfig?.requiresAttachment) && !attachmentFile) {
      return true;
    }

    if (!isOD && selectedLeaveTypeConfig?.deductsBalance && selectedBalance && selectedLeaveTypeConfig.leaveCode !== 'CO') {
      if (selectedBalance.available < totalDays) {
        return true;
      }
    }

    return submitting || false;
  })();

  const selectedBalance = getSelectedBalance();
  const isOD = selectedLeaveTypeConfig?.leaveCode === "OD";

  if (!hydrationComplete || authLoading || loading) {
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
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            Request Leave
          </h1>
          <p className="text-muted-foreground mt-1.5 text-base">
            Submit a new leave request for approval
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

      {/* Main Form */}
      <EnhancedCard 
        variant="elevated"
        padding="lg"
        className="mb-6"
        header={
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Leave Application</h3>
              <p className="text-sm text-muted-foreground">Fill in the details below to request leave</p>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Leave Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="leaveType" className="text-sm font-medium">Leave Type *</Label>
            <Select value={selectedLeaveType} onValueChange={handleLeaveTypeChange}>
              <SelectTrigger id="leaveType">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => {
                  const balance = balances[type.leaveCode];
                  const isAvailable = !type.deductsBalance || 
                                     (balance && balance.available > 0) ||
                                     type.leaveCode === 'CO';
                  return (
                    <SelectItem
                      key={type.id}
                      value={type.id}
                      disabled={!isAvailable}
                    >
                      {type.leaveName} ({type.leaveCode})
                      {type.deductsBalance && balance && type.leaveCode !== 'CO' && (
                        <span className="text-xs text-muted-foreground ml-2">
                          - {balance.available} days available
                        </span>
                      )}
                      {!isAvailable && type.deductsBalance && type.leaveCode !== 'CO' && (
                        <span className="text-xs text-red-500 ml-2">- Insufficient balance</span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedLeaveTypeConfig && selectedBalance && !isOD && (
              <div className={cn(
                "flex items-center gap-2 text-sm mt-1 p-2 rounded-lg",
                selectedBalance.available >= totalDays ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              )}>
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>
                  Available balance: <strong>{selectedBalance.available}</strong> days
                  {selectedLeaveTypeConfig.deductsBalance && selectedBalance.available < totalDays && (
                    <span className="text-red-500 ml-2 font-medium">
                      (Insufficient: need {totalDays - selectedBalance.available} more days)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* OD Info Alert */}
          {isOD && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">On Duty Leave</p>
                  <p className="text-sm text-blue-700">
                    On Duty (OD) leave does <strong>not</strong> deduct from your leave balance. 
                    You must provide event details and upload a supporting document.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Leave Duration */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Leave Duration *</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1",
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
                      onSelect={(date) => {
                        setStartDate(date);
                        if (isHalfDay && date) {
                          setEndDate(date);
                        }
                      }}
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
                        "w-full justify-start text-left font-normal mt-1",
                        !endDate && "text-muted-foreground",
                        isHalfDay && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={isHalfDay}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : isHalfDay ? "Same as start date" : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  {!isHalfDay && (
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
                  )}
                </Popover>
              </div>
            </div>
            {totalDays > 0 && (
              <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded-lg mt-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  Total days: <strong>{isHalfDay ? 0.5 : totalDays}</strong> day
                  {(!isHalfDay && totalDays !== 1) ? "s" : ""}
                  {isOD && <span className="text-blue-600 ml-2">(No balance deduction)</span>}
                </span>
              </div>
            )}
          </div>

          {/* Half Day Toggle */}
          {selectedLeaveTypeConfig?.allowHalfDay && !isOD && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="halfDay"
                  checked={isHalfDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsHalfDay(checked);
                    
                    if (checked && startDate) {
                      setEndDate(startDate);
                    }
                    
                    if (!checked) {
                      setEndDate(undefined);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="halfDay" className="cursor-pointer text-sm font-medium">
                  Half Day Leave
                </Label>
              </div>
              {isHalfDay && (
                <div className="flex gap-4 mt-2 p-3 bg-gray-50 rounded-lg">
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
                    <span className="text-sm">First Half</span>
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
                    <span className="text-sm">Second Half</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* OD Event Details */}
          {isOD && (
            <div className="space-y-4 border rounded-xl p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 text-blue-800 font-medium">
                <Briefcase className="h-5 w-5" />
                <h4>On Duty Event Details</h4>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="eventName" className="text-sm font-medium">Event Name *</Label>
                <Input
                  id="eventName"
                  placeholder="e.g., AI Faculty Development Program"
                  value={odDetails.eventName}
                  onChange={(e) => setOdDetails({ ...odDetails, eventName: e.target.value })}
                  className="border-blue-300 focus:border-blue-500 bg-white"
                />
                {odDetails.eventName && odDetails.eventName.length < 3 && (
                  <p className="text-xs text-red-500">Minimum 3 characters required</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="organization" className="text-sm font-medium">Organization *</Label>
                <Input
                  id="organization"
                  placeholder="e.g., IIT Bombay"
                  value={odDetails.organization}
                  onChange={(e) => setOdDetails({ ...odDetails, organization: e.target.value })}
                  className="border-blue-300 focus:border-blue-500 bg-white"
                />
                {odDetails.organization && odDetails.organization.length < 2 && (
                  <p className="text-xs text-red-500">Minimum 2 characters required</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="location" className="text-sm font-medium">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="e.g., Mumbai"
                    value={odDetails.location}
                    onChange={(e) => setOdDetails({ ...odDetails, location: e.target.value })}
                    className="pl-9 border-blue-300 focus:border-blue-500 bg-white"
                  />
                </div>
                {odDetails.location && odDetails.location.length < 2 && (
                  <p className="text-xs text-red-500">Minimum 2 characters required</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="purpose" className="text-sm font-medium">Purpose *</Label>
                <Textarea
                  id="purpose"
                  placeholder="Describe the purpose of this duty (e.g., Faculty Training, Research Collaboration, etc.)"
                  value={odDetails.purpose}
                  onChange={(e) => setOdDetails({ ...odDetails, purpose: e.target.value })}
                  rows={3}
                  className="border-blue-300 focus:border-blue-500 bg-white"
                />
                {odDetails.purpose && odDetails.purpose.length < 5 && (
                  <p className="text-xs text-red-500">Minimum 5 characters required</p>
                )}
              </div>

              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> All OD requests require a supporting document attachment.
                </p>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(Optional)</span></Label>
            <Textarea
              id="reason"
              placeholder="Briefly describe the reason for leave"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Alternate Faculty */}
          <div className="space-y-2">
            <Label htmlFor="alternateFaculty" className="text-sm font-medium">
              Alternate Faculty Name *
              <span className="text-xs text-muted-foreground ml-2 font-normal">
                (Who will cover your duties?)
              </span>
            </Label>
            <Input
              id="alternateFaculty"
              placeholder="Enter the name of the faculty member covering your duties"
              value={alternateFacultyName}
              onChange={(e) => setAlternateFacultyName(e.target.value)}
              required
              className={cn(
                alternateFacultyName.trim() && alternateFacultyName.trim().length < 3 && "border-red-300 focus:border-red-500"
              )}
            />
            {alternateFacultyName.trim() && alternateFacultyName.trim().length < 3 && (
              <p className="text-xs text-red-500">Name must be at least 3 characters</p>
            )}
          </div>

          {/* Attachment */}
          {(selectedLeaveTypeConfig?.requiresAttachment || isOD) && (
            <div className="space-y-2">
              <Label htmlFor="attachment" className="text-sm font-medium">
                Attachment {isOD ? "* (Required)" : "*"}
                <span className="text-xs text-muted-foreground ml-2 font-normal">
                  (PDF, DOC, JPG, PNG - Max 16MB)
                </span>
              </Label>
              <div className={cn(
                "border-2 border-dashed rounded-lg p-4 transition-colors",
                attachmentFile ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-primary/50"
              )}>
                <Input
                  id="attachment"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                  required={isOD}
                />
                {attachmentFile && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>File selected: <strong>{attachmentFile.name}</strong></span>
                    <span className="text-xs text-muted-foreground">
                      ({(attachmentFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
                {isOD && !attachmentFile && (
                  <p className="text-xs text-red-500 mt-1">Attachment is required for On Duty leave</p>
                )}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              disabled={submitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="flex-[2] gap-2"
            >
              {submitting ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  {uploading ? "Uploading..." : "Submitting..."}
                </>
              ) : (
                <>
                  Submit Leave Request
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium">About Your Leave Request</p>
                <ul className="text-sm text-blue-700 mt-1 list-disc list-inside space-y-1">
                  <li>Your request will be sent to your department HOD for approval</li>
                  <li>You can edit or cancel your request before it is approved</li>
                  <li>You will receive email and in-app notifications for status updates</li>
                  {!isOD && selectedLeaveTypeConfig?.deductsBalance && (
                    <li className="text-blue-800">
                      This leave type deducts from your balance. Make sure you have enough days available.
                    </li>
                  )}
                  {isOD && (
                    <li className="text-blue-800 font-medium">
                      📋 On Duty leave does NOT deduct from your leave balance.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </EnhancedCard>
    </div>
  );
}