// app/registrar/vacation/page.tsx
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, Check, X, Umbrella } from "lucide-react";

interface VacationRequest {
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
  status: string;
  createdAt: string;
  vacationDetails?: {
    vacationType: string;
    paidDays: number;
    unpaidDays: number;
  };
}

export default function RegistrarVacationPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
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
    if (!authLoading && user && !user.roles?.includes("registrar")) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/registrar/vacation");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch vacation requests");
      }

      setRequests(data.requests || []);
    } catch (error) {
      console.error("Error fetching vacation requests:", error);
      toast.error("Failed to fetch vacation requests");
    } finally {
      setLoading(false);
    }
  }, []);

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
      const response = await fetch(`/api/registrar/vacation/${requestId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve vacation request");
      }

      toast.success("Vacation request approved");
      setShowDetails(false);
      setSelectedRequest(null);
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchRequests();
      
      toast.success("📋 Vacation list updated");
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
      const response = await fetch(`/api/registrar/vacation/${rejectModal.requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectModal.reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject vacation request");
      }

      toast.success("Vacation request rejected");
      setRejectModal({ open: false, requestId: null, reason: "" });
      setShowDetails(false);
      setSelectedRequest(null);
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchRequests();
      
      toast.success("📋 Vacation list updated");
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

  if (!user || !user.roles?.includes("registrar")) {
    return null;
  }

  const pendingRequests = requests.filter(r => r.status === "Pending_Registrar");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Vacation Requests</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve vacation requests from office staff
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Umbrella className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              No pending vacation requests.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Vacation Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Total Days</TableHead>
                    <TableHead>Paid/Unpaid</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.applicantName}</TableCell>
                      <TableCell className="capitalize">{request.applicantRoles?.[0] || "Staff"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-purple-50">
                          {request.vacationDetails?.vacationType || "Vacation"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                      <TableCell>{request.totalDays} days</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-green-600">Paid: {request.vacationDetails?.paidDays || 0}</span>
                          {request.vacationDetails?.unpaidDays && request.vacationDetails.unpaidDays > 0 && (
                            <span className="text-amber-600 ml-2">
                              Unpaid: {request.vacationDetails.unpaidDays}
                            </span>
                          )}
                        </div>
                      </TableCell>
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

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vacation Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
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
                  <p className="text-sm text-muted-foreground">Vacation Type</p>
                  <p>{selectedRequest.vacationDetails?.vacationType || "Vacation"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date Range</p>
                  <p>
                    {new Date(selectedRequest.startDate).toLocaleDateString()} - {new Date(selectedRequest.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Days</p>
                  <p className="font-semibold">{selectedRequest.totalDays} days</p>
                </div>
                {selectedRequest.vacationDetails && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Paid Days</p>
                      <p className="text-green-600 font-medium">{selectedRequest.vacationDetails.paidDays} days</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Unpaid Days</p>
                      <p className="text-amber-600 font-medium">{selectedRequest.vacationDetails.unpaidDays} days</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Alternate Faculty</p>
                  <p>{selectedRequest.alternateFacultyName}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedRequest.reason}</p>
              </div>
            </div>
          )}
          <DialogFooter>
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
            <DialogTitle>Reject Vacation Request</DialogTitle>
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