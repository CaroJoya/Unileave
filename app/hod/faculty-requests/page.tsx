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
import { toast } from "sonner";
import { Eye, Check, X, MessageSquare, RefreshCw, Briefcase } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getLeaveTypeLabel } from "@/lib/constants/leave-types";
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
  odDetails?: {
    eventName: string;
    organization: string;
    location: string;
    purpose: string;
  };
}

interface Revision {
  id: string;
  cycleNumber: number;
  remarkText: string;
  remarkSentByName: string;
  remarkSentAt: string;
}

interface DetailsDrawerProps {
  request: LeaveRequest | null;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSendRemarks: () => void;
  loading: boolean;
}

function RequestDetailsDrawer({ 
  request, 
  open, 
  onClose, 
  onApprove, 
  onReject, 
  onSendRemarks,
  loading 
}: DetailsDrawerProps) {
  if (!request) return null;

  const isOD = request.leaveType === "OD";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leave Request Details</DialogTitle>
          <DialogDescription>
            Review the leave request before taking action
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Employee</Label>
              <p className="font-medium">{request.applicantName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Role</Label>
              <p className="font-medium capitalize">{request.applicantRoles?.[0] || "Staff"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Department</Label>
              <p className="font-medium">{request.departmentName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Leave Type</Label>
              <p className="font-medium">{isOD ? "On Duty (OD)" : getLeaveTypeLabel(request.leaveType)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Start Date</Label>
              <p>{new Date(request.startDate).toLocaleDateString()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">End Date</Label>
              <p>{new Date(request.endDate).toLocaleDateString()}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Days</Label>
              <p className="font-semibold">{request.totalDays} day(s)</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Submitted</Label>
              <p>{new Date(request.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {/* OD Details */}
          {isOD && request.odDetails && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4" />
                On Duty Details
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Event:</span>
                  <p className="font-medium">{request.odDetails.eventName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Organization:</span>
                  <p className="font-medium">{request.odDetails.organization}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>
                  <p className="font-medium">{request.odDetails.location}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Purpose:</span>
                  <p className="font-medium">{request.odDetails.purpose}</p>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-600">
                ℹ️ On Duty leave does not deduct from balance
              </div>
            </div>
          )}

          <div>
            <Label className="text-muted-foreground">Reason</Label>
            <p className="mt-1 p-3 bg-gray-50 rounded-lg">{request.reason}</p>
          </div>

          <div>
            <Label className="text-muted-foreground">Alternate Faculty</Label>
            <p className="font-medium">{request.alternateFacultyName}</p>
          </div>

          {request.revisionHistory && request.revisionHistory.length > 0 && (
            <div>
              <Label className="text-muted-foreground">Revision History</Label>
              <div className="mt-2 space-y-2">
                {request.revisionHistory.map((rev) => (
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

          {request.attachmentUrl && (
            <div>
              <Label className="text-muted-foreground">Attachment</Label>
              <div className="mt-1">
                <a 
                  href={request.attachmentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  View Attachment
                </a>
              </div>
            </div>
          )}

          {isOD && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> On Duty leave does not deduct from the employees leave balance.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="destructive" onClick={onReject} disabled={loading}>
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button variant="secondary" onClick={onSendRemarks} disabled={loading}>
            <MessageSquare className="h-4 w-4 mr-1" />
            Send Remarks
          </Button>
          <Button onClick={onApprove} disabled={loading}>
            <Check className="h-4 w-4 mr-1" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FacultyRequestsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [remarksModal, setRemarksModal] = useState<{ open: boolean; requestId: string | null; remarks: string }>({
    open: false,
    requestId: null,
    remarks: "",
  });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null; reason: string }>({
    open: false,
    requestId: null,
    reason: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && !user.roles?.includes("hod")) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hod/requests");
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

  useEffect(() => {
    if (user?.roles?.includes("hod")) {
      const loadData = async () => {
        await fetchRequests();
      };
      loadData();
    }
  }, [user, fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/hod/leave/${requestId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve request");
      }

      toast.success("Leave request approved");
      setShowDetails(false);
      setSelectedRequest(null);
      
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      
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
      const response = await fetch(`/api/hod/leave/${rejectModal.requestId}/reject`, {
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
      
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      
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
      const response = await fetch(`/api/hod/leave/${remarksModal.requestId}/remarks`, {
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
      
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      
      await fetchRequests();
      toast.success("📋 Request list updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send remarks";
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (revisionCount: number) => {
    if (revisionCount > 0) {
      return (
        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
          <RefreshCw className="h-3 w-3 mr-1" />
          Revision #{revisionCount}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        Pending
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user || !user.roles?.includes("hod")) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Faculty Leave Requests</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage leave requests from your department
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending leave requests from your department.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
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
                  {requests.map((request) => {
                    const isOD = request.leaveType === "OD";
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.applicantName}</TableCell>
                        <TableCell className="capitalize">{request.applicantRoles?.[0] || "Staff"}</TableCell>
                        <TableCell>
                          {isOD ? "On Duty (OD)" : getLeaveTypeLabel(request.leaveType)}
                          {isOD && <Badge variant="outline" className="ml-2 text-blue-600 border-blue-300 bg-blue-50 text-xs">No Balance Deduct</Badge>}
                        </TableCell>
                        <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                        <TableCell>{request.totalDays}</TableCell>
                        <TableCell>{getStatusBadge(request.revisionCount)}</TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RequestDetailsDrawer
        request={selectedRequest}
        open={showDetails}
        onClose={() => {
          setShowDetails(false);
          setSelectedRequest(null);
        }}
        onApprove={() => selectedRequest && handleApprove(selectedRequest.id)}
        onReject={() => {
          if (selectedRequest) {
            setRejectModal({ open: true, requestId: selectedRequest.id, reason: "" });
          }
        }}
        onSendRemarks={() => {
          if (selectedRequest) {
            setRemarksModal({ open: true, requestId: selectedRequest.id, remarks: "" });
          }
        }}
        loading={actionLoading}
      />

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