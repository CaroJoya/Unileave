// app/principal/comp-off/page.tsx
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, Check, X } from "lucide-react";

interface CompOffCredit {
  id: string;
  userId: string;
  userName: string;
  creditedDays: number;
  usedDays: number;
  earnedDate: string;
  reason: string;
  status: string;
}

export default function PrincipalCompOffPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CompOffCredit[]>([]);
  const [selectedCredit, setSelectedCredit] = useState<CompOffCredit | null>(null);
  const [showDetails, setShowDetails] = useState(false);
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

  const fetchCredits = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/principal/comp-off");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch comp-off requests");
      }

      setCredits(data.credits || []);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast.error("Failed to fetch comp-off requests");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data when user is authenticated - fixed with isMounted pattern
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (user?.roles?.includes("principal") && isMounted) {
        await fetchCredits();
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user, fetchCredits]);

  const handleApprove = async (creditId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/principal/comp-off/${creditId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve comp-off");
      }

      toast.success("Comp-off approved");
      setShowDetails(false);
      setSelectedCredit(null);
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchCredits();
      
      toast.success("📋 Comp-off list updated");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve";
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (creditId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/principal/comp-off/${creditId}/reject`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject comp-off");
      }

      toast.success("Comp-off rejected");
      setShowDetails(false);
      setSelectedCredit(null);
      
      // ✅ SMART REDIRECT: Refresh the list to show updated status
      await fetchCredits();
      
      toast.success("📋 Comp-off list updated");
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

  const pendingCredits = credits.filter(c => c.status === "pending_approval");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compensatory Off Requests</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve comp-off requests from HODs and Registrars
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {pendingCredits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending comp-off requests.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Credited Days</TableHead>
                    <TableHead>Earned Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCredits.map((credit) => (
                    <TableRow key={credit.id}>
                      <TableCell className="font-medium">{credit.userName}</TableCell>
                      <TableCell>{credit.creditedDays} day(s)</TableCell>
                      <TableCell>{new Date(credit.earnedDate).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-xs truncate">{credit.reason}</TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCredit(credit);
                              setShowDetails(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(credit.id)}
                            disabled={actionLoading}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(credit.id)}
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

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comp-Off Request Details</DialogTitle>
          </DialogHeader>
          {selectedCredit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedCredit.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Credited Days</p>
                  <p className="font-medium">{selectedCredit.creditedDays} day(s)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Earned Date</p>
                  <p>{new Date(selectedCredit.earnedDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedCredit.reason}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
            {selectedCredit && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => handleReject(selectedCredit.id)}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  onClick={() => handleApprove(selectedCredit.id)}
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
    </div>
  );
}