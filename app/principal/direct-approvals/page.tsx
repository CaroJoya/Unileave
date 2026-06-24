// app/principal/direct-approvals/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { Eye, Check, X, FileText, Clock } from "lucide-react";

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
  approvalLogs?: ApprovalLog[];
}

interface ApprovalLog {
  id: string;
  actionByName: string;
  actionRole: string;
  action: string;
  remark: string | null;
  oldStatus: string | null;
  newStatus: string;
  actionAt: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
  CO: "Compensatory Off",
  VL: "Vacation Leave",
  OD: "On Duty",
};

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    SUBMIT: "Submitted",
    APPROVE: "Approved",
    REJECT: "Rejected",
    SEND_REMARKS: "Sent Remarks",
    RESUBMIT: "Resubmitted",
    CANCEL: "Cancelled",
  };
  return labels[action] || action;
};

export default function PrincipalDirectApprovalsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null; reason: string }>({
    open: false,
    requestId: null,
    reason: "",
  });

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && !user.roles?.includes("principal")) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/principal/direct-approvals");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch requests");
      }

      setRequests(data.requests || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when user is authenticated
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (user?.roles?.includes("principal") && isMounted) {
        await fetchRequests();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user, fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/principal/leave/${requestId}/approve`, {
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
      const response = await fetch(`/api/principal/leave/${rejectModal.requestId}/reject`, {
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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user || !user.roles?.includes("principal")) {
    return null;
  }

  const pendingRequests = requests.filter(r => r.status === "Pending_Principal");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Direct Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve leave requests from HODs and Registrars
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending direct approval requests.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.applicantName}</TableCell>
                      <TableCell className="capitalize">{request.applicantRoles?.[0] || "Staff"}</TableCell>
                      <TableCell>{request.departmentName}</TableCell>
                      <TableCell>{LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType}</TableCell>
                      <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                      <TableCell>{request.totalDays}</TableCell>
                      <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
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
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(request.id)}
                            disabled={actionLoading}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setRejectModal({ open: true, requestId: request.id, reason: "" });
                            }}
                            disabled={actionLoading}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Details Drawer */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <DialogDescription>
              Review the complete leave request before taking action
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedRequest.applicantName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="capitalize">{selectedRequest.applicantRoles?.[0] || "Staff"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p>{selectedRequest.departmentName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Leave Type</p>
                  <p>{LEAVE_TYPE_LABELS[selectedRequest.leaveType] || selectedRequest.leaveType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date Range</p>
                  <p>
                    {new Date(selectedRequest.startDate).toLocaleDateString()} - {new Date(selectedRequest.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Days</p>
                  <p className="font-semibold">{selectedRequest.totalDays} day(s)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Alternate Faculty</p>
                  <p>{selectedRequest.alternateFacultyName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p>{new Date(selectedRequest.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Reason
                </p>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedRequest.reason}</p>
              </div>

              {/* Approval History */}
              {selectedRequest.approvalLogs && selectedRequest.approvalLogs.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Approval Timeline
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedRequest.approvalLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 text-sm p-2 bg-gray-50 rounded-lg">
                        <div className="w-24 flex-shrink-0 text-muted-foreground">
                          {new Date(log.actionAt).toLocaleDateString()}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{log.actionByName}</span>
                          <span className="text-muted-foreground"> ({log.actionRole}) </span>
                          <span>{getActionLabel(log.action)}</span>
                          {log.remark && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              &quot;{log.remark}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachment */}
              {selectedRequest.attachmentUrl && (
                <div>
                  <p className="text-sm text-muted-foreground">Attachment</p>
                  <a
                    href={selectedRequest.attachmentUrl}
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
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
            {selectedRequest && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    setShowDetails(false);
                    setRejectModal({ open: true, requestId: selectedRequest.id, reason: "" });
                  }}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  onClick={() => handleApprove(selectedRequest.id)}
                  disabled={actionLoading}
                >
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
    </div>
  );
}