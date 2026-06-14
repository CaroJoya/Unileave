// app/status/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit, XCircle, ChevronDown, ChevronUp, FileText, AlertCircle, History, CheckCircle, Clock, Ban } from "lucide-react";
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
};

export default function StatusPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [editForm, setEditForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    alternateFacultyName: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState<LeaveRequest | null>(null);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Fetch leave requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/leave/my-requests");
      const data = await response.json();
      if (response.ok) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.error || "Failed to fetch leave requests");
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to fetch leave requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user, fetchRequests]);

  // Apply filters
  useEffect(() => {
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
    if (leaveTypeFilter) {
      filtered = filtered.filter(r => r.leaveType === leaveTypeFilter);
    }
    
    // Date range filter
    if (dateRange.from) {
      filtered = filtered.filter(r => new Date(r.startDate) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(r => new Date(r.endDate) <= dateRange.to!);
    }
    
    setFilteredRequests(filtered);
  }, [requests, activeTab, leaveTypeFilter, dateRange]);

  const handleCancelRequest = async () => {
    if (!cancellingRequest) return;
    
    setEditLoading(true);
    try {
      const response = await fetch(`/api/leave/request/${cancellingRequest.id}/cancel`, {
        method: "PUT",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel request");
      }
      
      toast.success("Leave request cancelled successfully");
      setCancelDialogOpen(false);
      setCancellingRequest(null);
      fetchRequests();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel";
      toast.error(errorMessage);
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditRequest = async () => {
    if (!editingRequest) return;
    
    setEditLoading(true);
    try {
      const totalDays = (() => {
        if (editForm.startDate && editForm.endDate) {
          const start = new Date(editForm.startDate);
          const end = new Date(editForm.endDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
        return editingRequest.totalDays;
      })();
      
      const response = await fetch(`/api/leave/request/${editingRequest.id}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editForm.startDate || editingRequest.startDate,
          endDate: editForm.endDate || editingRequest.endDate,
          totalDays,
          isHalfDay: editingRequest.isHalfDay,
          halfDaySession: editingRequest.halfDaySession,
          reason: editForm.reason || editingRequest.reason,
          alternateFacultyName: editForm.alternateFacultyName || editingRequest.alternateFacultyName,
          attachmentUrl: editingRequest.attachmentUrl,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to update request");
      }
      
      toast.success("Leave request updated and resubmitted");
      setEditDialogOpen(false);
      setEditingRequest(null);
      fetchRequests();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update";
      toast.error(errorMessage);
    } finally {
      setEditLoading(false);
    }
  };

  const openEditDialog = (request: LeaveRequest) => {
    setEditingRequest(request);
    setEditForm({
      startDate: request.startDate.split("T")[0],
      endDate: request.endDate.split("T")[0],
      reason: request.reason,
      alternateFacultyName: request.alternateFacultyName,
    });
    setEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-800", icon: null };
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
    };
    return labels[action] || action;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Leave Status</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your leave requests
        </p>
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
                  <SelectItem value="">All types</SelectItem>
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
          
          {(leaveTypeFilter || dateRange.from || dateRange.to) && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLeaveTypeFilter("");
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
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="revision">Needs Revision</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No leave requests found
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRequests.map((request) => (
                <Card key={request.id} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-wrap justify-between items-start gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">
                            {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}
                          </h3>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                        </p>
                        <p className="text-sm mt-1">
                          Total: <span className="font-medium">{request.totalDays}</span> day{request.totalDays !== 1 ? "s" : ""}
                          {request.isHalfDay && ` (${request.halfDaySession})`}
                        </p>
                        <p className="text-sm mt-2">
                          Alternate Faculty: <span className="font-medium">{request.alternateFacultyName}</span>
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        {request.status === "Pending_Revision" && (
                          <Button size="sm" onClick={() => openEditDialog(request)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Edit & Resubmit
                          </Button>
                        )}
                        {(request.status === "Pending_HOD" || 
                          request.status === "Pending_Registrar" || 
                          request.status === "Pending_Principal" ||
                          request.status === "Pending_Revision") && (
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
                          variant="outline"
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
                        <div>
                          <h4 className="font-medium flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4" />
                            Reason
                          </h4>
                          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {request.reason}
                          </p>
                        </div>

                        {/* Approval Timeline */}
                        {request.app approvalLogs && request.approvalLogs.length > 0 && (
                          <div>
                            <h4 className="font-medium flex items-center gap-2 mb-3">
                              <History className="h-4 w-4" />
                              Approval Timeline
                            </h4>
                            <div className="space-y-3">
                              {request.approvalLogs.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 text-sm">
                                  <div className="w-24 flex-shrink-0 text-muted-foreground">
                                    {new Date(log.actionAt).toLocaleDateString()}
                                  </div>
                                  <div className="flex-1">
                                    <span className="font-medium">{log.actionByName}</span>
                                    <span className="text-muted-foreground"> ({log.actionRole}) </span>
                                    <span>{getActionLabel(log.action)}</span>
                                    {log.remark && (
                                      <p className="text-muted-foreground mt-1 text-xs bg-gray-50 p-2 rounded">
                                        "{log.remark}"
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit & Resubmit Leave Request</DialogTitle>
            <DialogDescription>
              Update your leave request details. Your changes will be sent for approval again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Alternate Faculty Name</Label>
              <Input
                value={editForm.alternateFacultyName}
                onChange={(e) => setEditForm({ ...editForm, alternateFacultyName: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRequest} disabled={editLoading}>
              {editLoading ? "Submitting..." : "Resubmit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Leave Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this leave request? This action cannot be undone.
              {cancellingRequest?.leaveType && (
                <span className="block mt-2 text-sm font-medium">
                  Leave Type: {LEAVE_TYPE_LABELS[cancellingRequest.leaveType]}
                  <br />
                  Dates: {new Date(cancellingRequest.startDate).toLocaleDateString()} - {new Date(cancellingRequest.endDate).toLocaleDateString()}
                </span>
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