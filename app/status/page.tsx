// app/status/page.tsx - COMPLETE FIXED FILE
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit, XCircle, ChevronDown, ChevronUp, FileText, AlertCircle, History, CheckCircle, Clock, Ban, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LeaveRequest {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  isHalfDay: boolean;
  halfDaySession: string | null;
  reason: string;
  alternateFacultyName: string;
  attachmentUrl: string | null;
  status: string;
  currentApproverId: string | null;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
  approvalLogs?: ApprovalLog[];
  revisionHistory?: RevisionHistory[];
}

interface ApprovalLog {
  id: string;
  actionBy: string;
  actionByName: string;
  actionRole: string;
  action: string;
  remark: string | null;
  oldStatus: string | null;
  newStatus: string;
  actionAt: string;
}

interface RevisionHistory {
  id: string;
  cycleNumber: number;
  remarkSentBy: string;
  remarkSentByName: string;
  remarkText: string;
  resubmittedBy: string | null;
  resubmittedAt: string | null;
}

interface LeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  deductsBalance: boolean;
  isActive: boolean;
}

interface LeaveBalance {
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Pending_HOD: { label: "Pending HOD", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
  Pending_Registrar: { label: "Pending Registrar", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
  Pending_Principal: { label: "Pending Principal", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
  Approved: { label: "Approved", color: "bg-green-100 text-green-800", icon: <CheckCircle className="h-3 w-3" /> },
  Rejected_HOD: { label: "Rejected by HOD", color: "bg-red-100 text-red-800", icon: <Ban className="h-3 w-3" /> },
  Rejected_Registrar: { label: "Rejected by Registrar", color: "bg-red-100 text-red-800", icon: <Ban className="h-3 w-3" /> },
  Rejected_Principal: { label: "Rejected by Principal", color: "bg-red-100 text-red-800", icon: <Ban className="h-3 w-3" /> },
  Pending_Revision: { label: "Needs Revision", color: "bg-purple-100 text-purple-800", icon: <AlertCircle className="h-3 w-3" /> },
  Cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: <XCircle className="h-3 w-3" /> },
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
  CO: "Compensatory Off",
  OD: "On Duty",
  MAT: "Maternity Leave",
  PAT: "Paternity Leave",
  SPL: "Special Leave",
};

export default function StatusPage() {
  const { user, isLoading: authLoading, hydrationComplete } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
  const [activeTab, setActiveTab] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [editForm, setEditForm] = useState({
    leaveType: "",
    startDate: "",
    endDate: "",
    isHalfDay: false,
    halfDaySession: "First Half" as "First Half" | "Second Half",
    reason: "",
    alternateFacultyName: "",
    attachmentUrl: null as string | null,
  });
  const [editLoading, setEditLoading] = useState(false);
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState<LeaveRequest | null>(null);

  const hasFetched = useRef(false);
  const isMounted = useRef(true);

  // Auth check
  useEffect(() => {
    if (!hydrationComplete) return;
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.roles?.includes("principal")) {
      router.push("/principal/dashboard");
      return;
    }
  }, [user, authLoading, router, hydrationComplete]);

  // Fetch leave types and balances
  const fetchLeaveTypesAndBalances = useCallback(async () => {
    try {
      // Fetch leave types
      const typesResponse = await fetch("/api/leave-types");
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
      console.error("Error fetching leave types/balances:", error);
    }
  }, []);

  // Fetch leave requests
  const fetchRequests = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log("📋 Fetching leave requests...");
      
      const response = await fetch("/api/leave/my-requests", {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`Failed to fetch requests: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("✅ Status data received:", data);
      
      setRequests(data.requests || []);
    } catch (error) {
      console.error("❌ Error fetching requests:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch leave requests");
      setRequests([]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [user]);

  // Fetch data once when user is available
  useEffect(() => {
    if (!hydrationComplete || !user || user.roles?.includes("principal")) return;
    
    if (!hasFetched.current) {
      hasFetched.current = true;
      Promise.all([fetchRequests(), fetchLeaveTypesAndBalances()]);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [user, fetchRequests, fetchLeaveTypesAndBalances, hydrationComplete]);

  // Apply filters using useMemo
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];
    
    // Tab filter
    if (activeTab !== "all") {
      if (activeTab === "pending") {
        filtered = filtered.filter(r => 
          r.status === "Pending_HOD" || 
          r.status === "Pending_Registrar" || 
          r.status === "Pending_Principal"
        );
      } else if (activeTab === "approved") {
        filtered = filtered.filter(r => r.status === "Approved");
      } else if (activeTab === "rejected") {
        filtered = filtered.filter(r => 
          r.status === "Rejected_HOD" || 
          r.status === "Rejected_Registrar" || 
          r.status === "Rejected_Principal"
        );
      } else if (activeTab === "cancelled") {
        filtered = filtered.filter(r => r.status === "Cancelled");
      } else if (activeTab === "revision") {
        filtered = filtered.filter(r => r.status === "Pending_Revision");
      }
    }
    
    // Leave type filter
    if (leaveTypeFilter && leaveTypeFilter !== "all") {
      filtered = filtered.filter(r => r.leaveType === leaveTypeFilter);
    }
    
    // Date range filter
    if (dateRange.from) {
      filtered = filtered.filter(r => new Date(r.startDate) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(r => new Date(r.endDate) <= dateRange.to!);
    }
    
    return filtered;
  }, [requests, activeTab, leaveTypeFilter, dateRange]);

  // ============ CANCEL HANDLER ============
// app/status/page.tsx - Updated handleCancelRequest function
// Find the existing handleCancelRequest function and replace it with this:

const handleCancelRequest = async () => {
  if (!cancellingRequest) return;
  
  setEditLoading(true);
  try {
    const response = await fetch(`/api/leave/request/${cancellingRequest.id}/cancel`, {
      method: "PUT",
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to cancel request");
    }
    
    const result = await response.json();
    
    // Show detailed success message with balance info
    if (result.balanceRestored) {
      toast.success(`✅ ${result.message}`);
    } else {
      toast.warning(`⚠️ ${result.message}`);
    }
    
    setCancelDialogOpen(false);
    setCancellingRequest(null);
    
    // Refresh both requests AND balances
    await fetchRequests();
    await fetchLeaveTypesAndBalances();
    
    // Force a UI update
    toast.success("📊 Dashboard balance updated");
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel";
    toast.error(errorMessage);
  } finally {
    setEditLoading(false);
  }
};

// ============ EDIT HANDLER - FIXED ============
const handleEditRequest = async () => {
  if (!editingRequest) return;
  
  setEditLoading(true);
  try {
    // Calculate total days
    let totalDays = editingRequest.totalDays;
    
    if (editForm.isHalfDay) {
      totalDays = 0.5;
    } else if (editForm.startDate && editForm.endDate) {
      const start = new Date(editForm.startDate);
      const end = new Date(editForm.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Get the leave type code from the selected ID
    const selectedLeaveType = leaveTypes.find(t => t.id === editForm.leaveType);
    const leaveTypeCode = selectedLeaveType?.leaveCode || editingRequest.leaveType;
    
    // ✅ CRITICAL FIX: Ensure dates are always valid strings in YYYY-MM-DD format
    const getValidDate = (dateStr: string | undefined): string => {
      if (!dateStr) return new Date().toISOString().split("T")[0];
      if (dateStr.includes("T")) {
        return dateStr.split("T")[0];
      }
      return dateStr;
    };
    
    // ✅ CRITICAL FIX: Handle attachmentUrl - convert undefined to null
    let attachmentUrl = editForm.attachmentUrl;
    if (attachmentUrl === undefined) {
      attachmentUrl = null;
    }
    if (attachmentUrl === "") {
      attachmentUrl = null;
    }
    if (editingRequest.attachmentUrl && attachmentUrl === null) {
      // User removed the attachment
      attachmentUrl = null;
    }
    if (!attachmentUrl && editingRequest.attachmentUrl) {
      attachmentUrl = editingRequest.attachmentUrl;
    }
    
    const requestBody = {
      leaveType: leaveTypeCode,
      startDate: getValidDate(editForm.startDate || editingRequest.startDate),
      endDate: getValidDate(editForm.endDate || editingRequest.endDate),
      totalDays,
      isHalfDay: editForm.isHalfDay,
      halfDaySession: editForm.isHalfDay ? editForm.halfDaySession : null,
      reason: editForm.reason || editingRequest.reason,
      alternateFacultyName: editForm.alternateFacultyName || editingRequest.alternateFacultyName,
      attachmentUrl: attachmentUrl, // ✅ Now always null or string, never undefined
    };
    
    console.log("📝 Submitting edit:", requestBody);
    
    const response = await fetch(`/api/leave/request/${editingRequest.id}/edit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to update request");
    }
    
    await response.json();
    
    const successMessage = editingRequest.status === "Pending_Revision"
      ? "Leave request resubmitted successfully!"
      : "Leave request updated successfully!";
    
    toast.success(successMessage);
    setEditDialogOpen(false);
    setEditingRequest(null);
    await fetchRequests();
    await fetchLeaveTypesAndBalances();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update";
    toast.error(errorMessage);
  } finally {
    setEditLoading(false);
  }
};
  // ============ OPEN EDIT DIALOG ============
  const openEditDialog = (request: LeaveRequest) => {
    // Get the leave type ID from the leave code
    const leaveTypeObj = leaveTypes.find(t => t.leaveCode === request.leaveType);
    const leaveTypeId = leaveTypeObj?.id || "";
    
    // ✅ Ensure dates are in YYYY-MM-DD format
    const getDatePart = (dateStr: string): string => {
      if (dateStr.includes("T")) {
        return dateStr.split("T")[0];
      }
      return dateStr;
    };
    
    setEditingRequest(request);
    setEditForm({
      leaveType: leaveTypeId,
      startDate: getDatePart(request.startDate),
      endDate: getDatePart(request.endDate),
      isHalfDay: request.isHalfDay,
      halfDaySession: (request.halfDaySession as "First Half" | "Second Half") || "First Half",
      reason: request.reason || "",
      alternateFacultyName: request.alternateFacultyName || "",
      attachmentUrl: request.attachmentUrl,
    });
    setEditDialogOpen(true);
  };

  // ============ CALCULATE TOTAL DAYS FOR DISPLAY ============
  const calculateTotalDays = (startDate: string, endDate: string, isHalfDay: boolean): number => {
    if (isHalfDay) return 0.5;
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  // ============ STATUS BADGE ============
  const getStatusBadge = (status: string, revisionCount: number = 0) => {
    const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-800", icon: null };
    
    if (status === "Pending_Revision") {
      return (
        <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
          <RefreshCw className="h-3 w-3" />
          Revision #{revisionCount}
        </Badge>
      );
    }
    
    return (
      <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      SUBMIT: "Submitted",
      APPROVE: "Approved",
      REJECT: "Rejected",
      SEND_REMARKS: "Sent Remarks",
      RESUBMIT: "Resubmitted",
      CANCEL: "Cancelled",
      PRINCIPAL_OVERRIDE: "Principal Override",
      EDIT: "Edited",
    };
    return labels[action] || action;
  };

  const isEditable = (status: string) => {
    return status === "Pending_HOD" || 
           status === "Pending_Registrar" || 
           status === "Pending_Revision";
  };

  const isCancellable = (status: string) => {
    return status === "Pending_HOD" || 
           status === "Pending_Registrar" || 
           status === "Pending_Principal" || 
           status === "Pending_Revision";
  };

  const getCounts = () => {
    const pending = requests.filter(r => 
      r.status === "Pending_HOD" || 
      r.status === "Pending_Registrar" || 
      r.status === "Pending_Principal"
    ).length;
    const approved = requests.filter(r => r.status === "Approved").length;
    const rejected = requests.filter(r => 
      r.status === "Rejected_HOD" || 
      r.status === "Rejected_Registrar" || 
      r.status === "Rejected_Principal"
    ).length;
    const revision = requests.filter(r => r.status === "Pending_Revision").length;
    const cancelled = requests.filter(r => r.status === "Cancelled").length;
    return { pending, approved, rejected, revision, cancelled };
  };

  const counts = getCounts();

  // Show loading state
  if (!hydrationComplete || authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your leave requests...</p>
        </div>
      </div>
    );
  }

  if (!user || user.roles?.includes("principal")) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Leave Status</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your leave requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{counts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Needs Revision</p>
            <p className="text-2xl font-bold text-purple-600">{counts.revision}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cancelled</p>
            <p className="text-2xl font-bold text-gray-600">{counts.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Leave Type</Label>
              <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([code, name]) => (
                    <SelectItem key={code} value={code}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Date Range (Start)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "PPP") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div>
              <Label>Date Range (End)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "PPP") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {(leaveTypeFilter !== "all" || dateRange.from || dateRange.to) && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLeaveTypeFilter("all");
                  setDateRange({ from: undefined, to: undefined });
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="revision">Needs Revision ({counts.revision})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({counts.cancelled})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium">No leave requests found</p>
                  <p className="text-sm">Try adjusting your filters or submit a new request</p>
                  <Button className="mt-4" onClick={() => router.push("/request-leave")}>
                    Request Leave
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <Card key={request.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg">
                            {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}
                          </h3>
                          {getStatusBadge(request.status, request.revisionCount)}
                          {request.isHalfDay && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              Half Day ({request.halfDaySession})
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                        </p>
                        <p className="text-sm mt-1">
                          Total: <span className="font-medium">{request.totalDays}</span> day{request.totalDays !== 1 ? "s" : ""}
                        </p>
                        <p className="text-sm mt-2">
                          Alternate Faculty: <span className="font-medium">{request.alternateFacultyName}</span>
                        </p>
                        {request.status === "Pending_Revision" && request.revisionHistory && request.revisionHistory.length > 0 && (
                          <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-sm text-purple-800 font-medium flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              Latest Remarks:
                            </p>
                            <p className="text-sm text-purple-700 mt-1">
                              {request.revisionHistory[request.revisionHistory.length - 1].remarkText}
                            </p>
                            <p className="text-xs text-purple-500 mt-1">
                              From: {request.revisionHistory[request.revisionHistory.length - 1].remarkSentByName}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {isEditable(request.status) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditDialog(request)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            {request.status === "Pending_Revision" ? "Edit & Resubmit" : "Edit"}
                          </Button>
                        )}
                        {isCancellable(request.status) && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => {
                              setCancellingRequest(request);
                              setCancelDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                        >
                          {expandedRequest === request.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Details
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedRequest === request.id && (
                      <div className="mt-6 pt-4 border-t space-y-6">
                        {/* Reason */}
                        {request.reason && (
                          <div>
                            <h4 className="font-medium flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4" />
                              Reason
                            </h4>
                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                              {request.reason}
                            </p>
                          </div>
                        )}

                        {/* Approval Timeline */}
                        {request.approvalLogs && request.approvalLogs.length > 0 && (
                          <div>
                            <h4 className="font-medium flex items-center gap-2 mb-3">
                              <History className="h-4 w-4" />
                              Approval Timeline
                            </h4>
                            <div className="space-y-3">
                              {request.approvalLogs.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 text-sm">
                                  <div className="w-28 flex-shrink-0 text-muted-foreground">
                                    {new Date(log.actionAt).toLocaleDateString()}
                                  </div>
                                  <div className="flex-1">
                                    <span className="font-medium">{log.actionByName}</span>
                                    <span className="text-muted-foreground"> ({log.actionRole}) </span>
                                    <span>{getActionLabel(log.action)}</span>
                                    {log.remark && (
                                      <p className="text-muted-foreground mt-1 text-xs bg-gray-50 p-2 rounded">
                                        &quot;{log.remark}&quot;
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Revision History */}
                        {request.revisionHistory && request.revisionHistory.length > 0 && (
                          <div>
                            <h4 className="font-medium flex items-center gap-2 mb-3">
                              <AlertCircle className="h-4 w-4" />
                              Revision History
                            </h4>
                            <div className="space-y-3">
                              {request.revisionHistory.map((rev) => (
                                <div key={rev.id} className="bg-amber-50 p-3 rounded-lg">
                                  <p className="text-sm font-medium">Revision #{rev.cycleNumber}</p>
                                  <p className="text-sm text-amber-800 mt-1">
                                    <strong>Remarks:</strong> {rev.remarkText}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Sent by: {rev.remarkSentByName}
                                  </p>
                                  {rev.resubmittedAt && (
                                    <p className="text-xs text-green-600 mt-1">
                                      Resubmitted on: {new Date(rev.resubmittedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Attachment */}
                        {request.attachmentUrl && (
                          <div>
                            <h4 className="font-medium mb-2">Attachment</h4>
                            <a
                              href={request.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              View Attachment
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ============ EDIT DIALOG ============ */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setEditingRequest(null);
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRequest?.status === "Pending_Revision" ? "Edit & Resubmit Leave Request" : "Edit Leave Request"}
            </DialogTitle>
            <DialogDescription>
              {editingRequest?.status === "Pending_Revision" 
                ? "Update your leave request based on the remarks and resubmit for approval."
                : "Update your leave request details. Changes will be saved."}
            </DialogDescription>
          </DialogHeader>

          {/* Revision Remarks - Show if pending revision */}
          {editingRequest?.status === "Pending_Revision" && editingRequest.revisionHistory && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Remarks from Approver:
              </p>
              <p className="text-sm text-amber-700 mt-1">
                {editingRequest.revisionHistory[editingRequest.revisionHistory.length - 1]?.remarkText}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* 1. LEAVE TYPE - Always editable */}
            <div className="space-y-2">
              <Label htmlFor="editLeaveType">Leave Type *</Label>
              <Select
                value={editForm.leaveType || ""}
                onValueChange={(value) => {
                  const selectedType = leaveTypes.find(t => t.id === value);
                  setEditForm({ 
                    ...editForm, 
                    leaveType: value,
                    isHalfDay: selectedType?.allowHalfDay ? editForm.isHalfDay : false,
                    halfDaySession: selectedType?.allowHalfDay ? editForm.halfDaySession : "First Half",
                  });
                }}
              >
                <SelectTrigger id="editLeaveType">
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
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Changing leave type will update balance calculations
              </p>
            </div>

            {/* 2. HALF DAY TOGGLE - Always editable */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editHalfDay"
                  checked={editForm.isHalfDay || false}
                  onChange={(e) => {
                    const isHalfDay = e.target.checked;
                    setEditForm({
                      ...editForm,
                      isHalfDay,
                      endDate: isHalfDay ? editForm.startDate : editForm.endDate,
                      halfDaySession: isHalfDay ? editForm.halfDaySession || "First Half" : "First Half",
                    });
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  disabled={(() => {
                    const selectedType = leaveTypes.find(t => t.id === editForm.leaveType);
                    return selectedType ? !selectedType.allowHalfDay : false;
                  })()}
                />
                <Label htmlFor="editHalfDay" className="cursor-pointer">
                  Half Day Leave
                </Label>
              </div>
              
              {editForm.isHalfDay && (
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="First Half"
                      checked={editForm.halfDaySession === "First Half"}
                      onChange={(e) => setEditForm({ ...editForm, halfDaySession: e.target.value as "First Half" | "Second Half" })}
                      className="w-4 h-4"
                    />
                    <span>First Half</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="Second Half"
                      checked={editForm.halfDaySession === "Second Half"}
                      onChange={(e) => setEditForm({ ...editForm, halfDaySession: e.target.value as "First Half" | "Second Half" })}
                      className="w-4 h-4"
                    />
                    <span>Second Half</span>
                  </label>
                </div>
              )}
            </div>

            {/* 3. DATES */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editForm.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.startDate ? format(new Date(editForm.startDate), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editForm.startDate ? new Date(editForm.startDate) : undefined}
                      onSelect={(date) => {
                        const newStartDate = date ? date.toISOString().split("T")[0] : "";
                        setEditForm({
                          ...editForm,
                          startDate: newStartDate,
                          endDate: editForm.isHalfDay ? newStartDate : editForm.endDate,
                        });
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date {!editForm.isHalfDay && "*"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editForm.endDate && "text-muted-foreground",
                        editForm.isHalfDay && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={editForm.isHalfDay}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editForm.endDate ? format(new Date(editForm.endDate), "PPP") : 
                        editForm.isHalfDay ? "Same as start date" : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  {!editForm.isHalfDay && (
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={editForm.endDate ? new Date(editForm.endDate) : undefined}
                        onSelect={(date) => {
                          const newEndDate = date ? date.toISOString().split("T")[0] : "";
                          if (editForm.startDate && new Date(newEndDate) < new Date(editForm.startDate)) {
                            toast.error("End date cannot be before start date");
                            return;
                          }
                          setEditForm({ ...editForm, endDate: newEndDate });
                        }}
                        disabled={(date) => {
                          if (!editForm.startDate) return true;
                          return date < new Date(editForm.startDate);
                        }}
                      />
                    </PopoverContent>
                  )}
                </Popover>
              </div>
            </div>

            {/* 4. TOTAL DAYS - Auto-calculated */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm">
                Total Days: <strong>
                  {editForm.isHalfDay ? 0.5 : (() => {
                    if (editForm.startDate && editForm.endDate) {
                      return calculateTotalDays(editForm.startDate, editForm.endDate, false);
                    }
                    return editingRequest?.totalDays || 0;
                  })()}
                </strong>
              </p>
              {editForm.isHalfDay && (
                <p className="text-xs text-muted-foreground mt-1">
                  Half-day leave counts as 0.5 day
                </p>
              )}
            </div>

            {/* 5. REASON */}
            <div className="space-y-2">
              <Label htmlFor="editReason">Reason</Label>
              <Textarea
                id="editReason"
                value={editForm.reason || ""}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                rows={3}
              />
            </div>

            {/* 6. ALTERNATE FACULTY */}
            <div className="space-y-2">
              <Label htmlFor="editAlternateFaculty">Alternate Faculty Name *</Label>
              <Input
                id="editAlternateFaculty"
                value={editForm.alternateFacultyName || ""}
                onChange={(e) => setEditForm({ ...editForm, alternateFacultyName: e.target.value })}
                placeholder="Name of faculty covering your duties"
              />
              {editForm.alternateFacultyName && editForm.alternateFacultyName.trim().length < 3 && (
                <p className="text-xs text-red-500">Name must be at least 3 characters</p>
              )}
            </div>

            {/* 7. ATTACHMENT - Show if required */}
            {(() => {
              const selectedType = leaveTypes.find(t => t.id === editForm.leaveType);
              if (!selectedType?.requiresAttachment) return null;
              
              return (
                <div className="space-y-2">
                  <Label>Attachment</Label>
                  {editingRequest?.attachmentUrl ? (
                    <div className="flex items-center gap-2">
                      <a
                        href={editingRequest.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        View current attachment
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditForm({ ...editForm, attachmentUrl: null })}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Attachment is required for this leave type
                    </p>
                  )}
                </div>
              );
            })()}

            {/* 8. BALANCE WARNING */}
            {(() => {
              const selectedType = leaveTypes.find(t => t.id === editForm.leaveType);
              if (!selectedType?.deductsBalance) return null;
              
              const balance = balances[selectedType.leaveCode];
              if (!balance) return null;
              
              const newTotalDays = editForm.isHalfDay ? 0.5 : (() => {
                if (editForm.startDate && editForm.endDate) {
                  return calculateTotalDays(editForm.startDate, editForm.endDate, false);
                }
                return editingRequest?.totalDays || 0;
              })();
              
              const willExceed = balance.available < newTotalDays;
              
              return (
                <div className={cn(
                  "p-3 rounded-lg",
                  willExceed ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
                )}>
                  <p className="text-sm">
                    <span className="font-medium">{selectedType.leaveCode} Balance:</span>{" "}
                    {balance.available} days available
                    {willExceed && (
                      <span className="text-red-600 block mt-1">
                        ⚠️ Insufficient balance! Need {newTotalDays} days, only {balance.available} available.
                      </span>
                    )}
                    {!willExceed && newTotalDays > 0 && (
                      <span className="text-green-600 block mt-1">
                        ✓ You have enough balance for this request.
                      </span>
                    )}
                  </p>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditRequest} 
              disabled={
                editLoading || 
                !editForm.alternateFacultyName?.trim() ||
                !editForm.leaveType ||
                !editForm.startDate ||
                (!editForm.isHalfDay && !editForm.endDate)
              }
              className="flex-1"
            >
              {editLoading ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Submitting...
                </>
              ) : (
                editingRequest?.status === "Pending_Revision" ? "Resubmit Request" : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCancelDialogOpen(false);
          setCancellingRequest(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Leave Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this leave request? This action cannot be undone.
              {cancellingRequest?.leaveType && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">
                    <strong>Leave Type:</strong> {LEAVE_TYPE_LABELS[cancellingRequest.leaveType]}
                  </p>
                  <p className="text-sm">
                    <strong>Dates:</strong> {new Date(cancellingRequest.startDate).toLocaleDateString()} - {new Date(cancellingRequest.endDate).toLocaleDateString()}
                  </p>
                  <p className="text-sm">
                    <strong>Days:</strong> {cancellingRequest.totalDays} day(s)
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Request
            </Button>
            <Button variant="destructive" onClick={handleCancelRequest} disabled={editLoading}>
              {editLoading ? "Cancelling..." : "Yes, Cancel Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}