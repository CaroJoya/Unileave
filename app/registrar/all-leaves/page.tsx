"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, Check, X, MessageSquare, RefreshCw, Search, FileText, AlertCircle, Download } from "lucide-react";

interface LeaveRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantRoles: string[];
  departmentId: string;
  departmentName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  alternateFacultyName: string;
  attachmentUrl: string | null;
  status: string;
  createdAt: string;
  revisionCount: number;
  revisionHistory?: Revision[];
}

interface Revision {
  id: string;
  cycleNumber: number;
  remarkText: string;
  remarkSentByName: string;
  remarkSentAt: string;
}

interface Department {
  id: string;
  name: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
  CO: "Compensatory Off",
  VL: "Vacation Leave",
  OD: "On Duty",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Pending_HOD: { label: "Pending HOD", color: "bg-yellow-100 text-yellow-800" },
  Pending_Registrar: { label: "Pending Registrar", color: "bg-yellow-100 text-yellow-800" },
  Pending_Principal: { label: "Pending Principal", color: "bg-yellow-100 text-yellow-800" },
  Approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  Rejected_HOD: { label: "Rejected by HOD", color: "bg-red-100 text-red-800" },
  Rejected_Registrar: { label: "Rejected by Registrar", color: "bg-red-100 text-red-800" },
  Rejected_Principal: { label: "Rejected by Principal", color: "bg-red-100 text-red-800" },
  Pending_Revision: { label: "Needs Revision", color: "bg-purple-100 text-purple-800" },
  Cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
};

export default function RegistrarAllLeavesPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  
  // Filters
  const [filters, setFilters] = useState({
    departmentId: "",
    role: "",
    leaveType: "",
    status: "",
    search: "",
    startDate: "",
    endDate: "",
  });
  
  // Modals
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null; reason: string }>({
    open: false,
    requestId: null,
    reason: "",
  });
  const [remarksModal, setRemarksModal] = useState<{ open: boolean; requestId: string | null; remarks: string }>({
    open: false,
    requestId: null,
    remarks: "",
  });

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && !user.roles?.includes("registrar")) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  // Check URL params for initial tab - using a ref to avoid ESLint warning
  // Check URL params for initial tab
const hasSetInitialTab = React.useRef(false);
useEffect(() => {
  if (!hasSetInitialTab.current) {
    const viewParam = searchParams.get("view");
    if (viewParam === "all") {
      // Use setTimeout to avoid ESLint set-state-in-effect warning
      setTimeout(() => {
        setActiveTab("all");
      }, 0);
      hasSetInitialTab.current = true;
    }
  }
}, [searchParams]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view: activeTab === "pending" ? "pending" : "all",
      });
      if (filters.departmentId) params.append("departmentId", filters.departmentId);
      if (filters.role) params.append("role", filters.role);
      if (filters.leaveType) params.append("leaveType", filters.leaveType);
      if (filters.status && activeTab === "all") params.append("status", filters.status);
      if (filters.search) params.append("search", filters.search);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(`/api/registrar/leaves?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch requests");
      }

      setRequests(data.requests || []);
      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  }, [activeTab, filters]);

  // Load data when user is authenticated
  useEffect(() => {
    if (user?.roles?.includes("registrar")) {
      const loadData = async () => {
        await fetchRequests();
      };
      loadData();
    }
  }, [user, fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/registrar/leave/${requestId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve request");
      }

      toast.success("Leave request approved");
      setShowDetails(false);
      setSelectedRequest(null);
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchRequests();
      
      toast.success("📋 Request list updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve";
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.requestId) return;
    if (!rejectModal.reason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/registrar/leave/${rejectModal.requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectModal.reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject request");
      }

      toast.success("Leave request rejected");
      setRejectModal({ open: false, requestId: null, reason: "" });
      setShowDetails(false);
      setSelectedRequest(null);
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchRequests();
      
      toast.success("📋 Request list updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reject";
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendRemarks = async () => {
    if (!remarksModal.requestId) return;
    if (!remarksModal.remarks.trim()) {
      toast.error("Please provide remarks");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/registrar/leave/${remarksModal.requestId}/remarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: remarksModal.remarks }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send remarks");
      }

      toast.success("Remarks sent for revision");
      setRemarksModal({ open: false, requestId: null, remarks: "" });
      setShowDetails(false);
      setSelectedRequest(null);
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchRequests();
      
      toast.success("📋 Request list updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send remarks";
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string, revisionCount: number) => {
    if (status === "Pending_Revision") {
      return (
        <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          Revision #{revisionCount}
        </Badge>
      );
    }
    const config = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-800" };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const resetFilters = () => {
    setFilters({
      departmentId: "",
      role: "",
      leaveType: "",
      status: "",
      search: "",
      startDate: "",
      endDate: "",
    });
  };

  const exportToCSV = () => {
    const headers = ["Employee", "Department", "Role", "Leave Type", "Start Date", "End Date", "Days", "Status", "Submitted"];
    const csvRows = [headers];
    
    for (const req of requests) {
      csvRows.push([
        req.applicantName,
        req.departmentName,
        req.applicantRoles?.[0] || "Staff",
        LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType,
        new Date(req.startDate).toLocaleDateString(),
        new Date(req.endDate).toLocaleDateString(),
        req.totalDays.toString(),
        STATUS_CONFIG[req.status]?.label || req.status,
        new Date(req.createdAt).toLocaleDateString(),
      ]);
    }
    
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave_requests_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  // Check if user can take actions (only on pending tab)
  const canTakeAction = activeTab === "pending";

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user || !user.roles?.includes("registrar")) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leave Requests</h1>
          <p className="text-muted-foreground mt-2">
            {activeTab === "pending" 
              ? "Review and manage leave requests from office staff and head clerks"
              : "View all leave requests across the college (Read-only)"}
          </p>
        </div>
        <Button variant="outline" onClick={exportToCSV} disabled={requests.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="all">All Requests (Read-Only)</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label>Department</Label>
                  <Select value={filters.departmentId} onValueChange={(v) => setFilters({ ...filters, departmentId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={filters.role} onValueChange={(v) => setFilters({ ...filters, role: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All roles</SelectItem>
                      <SelectItem value="office_staff">Office Staff</SelectItem>
                      <SelectItem value="head_clerk">Head Clerk</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="lab_assistant">Lab Assistant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Leave Type</Label>
                  <Select value={filters.leaveType} onValueChange={(v) => setFilters({ ...filters, leaveType: v })}>
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
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              
              {activeTab === "all" && (
                <div className="grid gap-4 md:grid-cols-3 mt-4">
                  <div>
                    <Label>Status</Label>
                    <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="All status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All status</SelectItem>
                        <SelectItem value="Pending_HOD">Pending HOD</SelectItem>
                        <SelectItem value="Pending_Registrar">Pending Registrar</SelectItem>
                        <SelectItem value="Pending_Principal">Pending Principal</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected_HOD">Rejected by HOD</SelectItem>
                        <SelectItem value="Rejected_Registrar">Rejected by Registrar</SelectItem>
                        <SelectItem value="Rejected_Principal">Rejected by Principal</SelectItem>
                        <SelectItem value="Pending_Revision">Needs Revision</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
                  </div>
                </div>
              )}
              
              <div className="flex justify-between gap-2 mt-4">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
                <Button size="sm" onClick={() => fetchRequests()}>
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Requests Table */}
          <Card>
            <CardContent className="pt-6">
              {requests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No leave requests found.
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.applicantName}</TableCell>
                          <TableCell>{request.departmentName}</TableCell>
                          <TableCell className="capitalize">{request.applicantRoles?.[0] || "Staff"}</TableCell>
                          <TableCell>{LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}</TableCell>
                          <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                          <TableCell>{request.totalDays}</TableCell>
                          <TableCell>{getStatusBadge(request.status, request.revisionCount)}</TableCell>
                          <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowDetails(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Details Drawer */}
      <Dialog open={showDetails} onOpenChange={(open) => {
        if (!open) {
          setShowDetails(false);
          setSelectedRequest(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <DialogDescription>
              {canTakeAction && selectedRequest?.status === "Pending_Registrar" 
                ? "Review the leave request before taking action"
                : "View leave request details (Read-only)"}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Employee</Label>
                  <p className="font-medium">{selectedRequest.applicantName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Role</Label>
                  <p className="capitalize">{selectedRequest.applicantRoles?.[0] || "Staff"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Department</Label>
                  <p>{selectedRequest.departmentName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Leave Type</Label>
                  <p>{LEAVE_TYPE_LABELS[selectedRequest.leaveType] || selectedRequest.leaveType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date Range</Label>
                  <p>{new Date(selectedRequest.startDate).toLocaleDateString()} - {new Date(selectedRequest.endDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Days</Label>
                  <p className="font-semibold">{selectedRequest.totalDays} day(s)</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Alternate Faculty</Label>
                  <p>{selectedRequest.alternateFacultyName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p>{new Date(selectedRequest.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status, selectedRequest.revisionCount)}</div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <Label className="text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Reason
                </Label>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedRequest.reason}</p>
              </div>

              {/* Revision History */}
              {selectedRequest.revisionHistory && selectedRequest.revisionHistory.length > 0 && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Revision History
                  </Label>
                  <div className="mt-2 space-y-2">
                    {selectedRequest.revisionHistory.map((rev) => (
                      <div key={rev.id} className="p-3 bg-amber-50 rounded-lg">
                        <p className="text-sm font-medium">Revision #{rev.cycleNumber}</p>
                        <p className="text-sm text-amber-800">{rev.remarkText}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sent by: {rev.remarkSentByName}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachment */}
              {selectedRequest.attachmentUrl && (
                <div>
                  <Label className="text-muted-foreground">Attachment</Label>
                  <div className="mt-1">
                    <a href={selectedRequest.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      View Attachment
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
            {canTakeAction && selectedRequest && selectedRequest.status === "Pending_Registrar" && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => setRejectModal({ open: true, requestId: selectedRequest.id, reason: "" })}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setRemarksModal({ open: true, requestId: selectedRequest.id, remarks: "" })}
                  disabled={actionLoading}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Send Remarks
                </Button>
                <Button onClick={() => handleApprove(selectedRequest.id)} disabled={actionLoading}>
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModal.open} onOpenChange={(open) => !open && setRejectModal({ ...rejectModal, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be shared with the applicant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                placeholder="Enter the reason for rejection..."
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal({ open: false, requestId: null, reason: "" })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? "Rejecting..." : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Remarks Modal */}
      <Dialog open={remarksModal.open} onOpenChange={(open) => !open && setRemarksModal({ ...remarksModal, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Revision Remarks</DialogTitle>
            <DialogDescription>
              Provide feedback for the applicant to revise their request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Remarks *</Label>
              <Textarea
                placeholder="Enter revision remarks..."
                value={remarksModal.remarks}
                onChange={(e) => setRemarksModal({ ...remarksModal, remarks: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemarksModal({ open: false, requestId: null, remarks: "" })}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleSendRemarks} disabled={actionLoading}>
              {actionLoading ? "Sending..." : "Send Remarks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}