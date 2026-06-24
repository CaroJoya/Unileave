// app/principal/override-eligible/page.tsx
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
import { Eye, AlertTriangle, X } from "lucide-react";

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
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  EL: "Earned Leave",
  ML: "Medical Leave",
};

const APPROVED_BY_LABELS: Record<string, string> = {
  hod: "HOD",
  registrar: "Registrar",
};

export default function PrincipalOverrideEligiblePage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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
      const response = await fetch("/api/principal/override-eligible");
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

  // Load data when user is authenticated - fixed with isMounted pattern
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

  const handleOverride = async () => {
    if (!selectedRequest) return;
    if (!overrideReason.trim()) {
      toast.error("Please provide an override reason");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`/api/principal/override/${selectedRequest.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: overrideReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to override request");
      }

      toast.success("Leave request overridden successfully");
      setShowOverrideModal(false);
      setShowDetails(false);
      setSelectedRequest(null);
      setOverrideReason("");
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchRequests();
      
      toast.success("📋 Request list updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to override";
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Override Eligible Requests</h1>
        <p className="text-muted-foreground mt-2">
          Review and override already approved leave requests (CL, EL, ML only)
        </p>
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <strong>Note:</strong> Overriding an approved request will restore the employee&apos;s leave balance.
            This action cannot be undone.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No override eligible requests found.
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
                    <TableHead>Approved By</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Approved Date</TableHead>
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
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50">
                          {APPROVED_BY_LABELS[request.approvedBy || ""] || request.approvedBy}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(request.startDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(request.endDate).toLocaleDateString()}</TableCell>
                      <TableCell>{request.totalDays}</TableCell>
                      <TableCell>
                        {request.approvedAt ? new Date(request.approvedAt).toLocaleDateString() : "-"}
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
                            variant="destructive"
                            onClick={() => {
                              setSelectedRequest(request);
                              setOverrideReason("");
                              setShowOverrideModal(true);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Override
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <DialogDescription>
              Review the approved leave request before overriding
            </DialogDescription>
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
                  <p className="text-sm text-muted-foreground">Leave Type</p>
                  <p>{LEAVE_TYPE_LABELS[selectedRequest.leaveType] || selectedRequest.leaveType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved By</p>
                  <p className="capitalize">{selectedRequest.approvedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved On</p>
                  <p>{selectedRequest.approvedAt ? new Date(selectedRequest.approvedAt).toLocaleDateString() : "-"}</p>
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
              <Button 
                variant="destructive" 
                onClick={() => {
                  setShowDetails(false);
                  setShowOverrideModal(true);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Override Request
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Modal */}
      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Approved Leave Request</DialogTitle>
            <DialogDescription>
              <div className="space-y-2">
                <p>This action will:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Reject the already approved leave request</li>
                  <li>Restore the employee&apos;s leave balance</li>
                  <li>Notify the employee only (HOD/Registrar will NOT be notified)</li>
                </ul>
                <p className="text-red-600 font-medium mt-2">This action cannot be undone.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm">
                  <strong>Employee:</strong> {selectedRequest.applicantName}
                </p>
                <p className="text-sm">
                  <strong>Leave Type:</strong> {LEAVE_TYPE_LABELS[selectedRequest.leaveType]}
                </p>
                <p className="text-sm">
                  <strong>Dates:</strong> {new Date(selectedRequest.startDate).toLocaleDateString()} - {new Date(selectedRequest.endDate).toLocaleDateString()}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="overrideReason">Override Reason *</Label>
              <Textarea
                id="overrideReason"
                placeholder="Why is this override necessary?"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleOverride} disabled={actionLoading}>
              {actionLoading ? "Processing..." : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}