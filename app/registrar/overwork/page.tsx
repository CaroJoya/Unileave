// app/registrar/overwork/page.tsx
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, Check, X } from "lucide-react";

interface OverworkEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  hours: number;
  workDate: string;
  reason: string;
  status: string;
}

interface OverworkConfig {
  conversionHours: number;
}

export default function RegistrarOverworkPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<OverworkEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<OverworkEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [config, setConfig] = useState<OverworkConfig | null>(null);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && !user.roles?.includes("registrar")) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/headclerk/overwork-config");
      const data = await response.json();
      if (data.config) {
        setConfig({
          conversionHours: data.config.conversionHours || 5,
        });
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/registrar/overwork");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch overwork entries");
      }

      setEntries(data.entries || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast.error("Failed to fetch overwork entries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  if (user?.roles?.includes("registrar")) {
    const loadData = async () => {
      await Promise.all([fetchConfig(), fetchEntries()]);
    };
    loadData();
  }
}, [user, fetchConfig, fetchEntries]);

  const handleApprove = async (entryId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/registrar/overwork/${entryId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve overwork");
      }

      const earnedDays = data.earnedLeaveDays;
      toast.success(`Overwork approved${earnedDays ? ` - ${earnedDays} comp-off day(s) earned` : ''}`);
      setShowDetails(false);
      setSelectedEntry(null);
      fetchEntries();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to approve";
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (entryId: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/registrar/overwork/${entryId}/reject`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject overwork");
      }

      toast.success("Overwork rejected");
      setShowDetails(false);
      setSelectedEntry(null);
      fetchEntries();
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

  const pendingEntries = entries.filter(e => e.status === "pending");

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Overwork Requests</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve overwork entries from office staff
        </p>
        {config && (
          <p className="text-sm text-muted-foreground mt-1">
            Conversion rate: {config.conversionHours} hours = 1 comp-off day
          </p>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {pendingEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No pending overwork requests.
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Work Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Potential Comp-Off</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEntries.map((entry) => {
                    const potentialDays = config ? Math.floor(entry.hours / config.conversionHours) : 0;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.userName}</TableCell>
                        <TableCell className="capitalize">{entry.userRole}</TableCell>
                        <TableCell>{new Date(entry.workDate).toLocaleDateString()}</TableCell>
                        <TableCell>{entry.hours}</TableCell>
                        <TableCell>
                          {potentialDays > 0 ? `${potentialDays} day(s)` : "None"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{entry.reason || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedEntry(entry);
                                setShowDetails(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(entry.id)}
                              disabled={actionLoading}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(entry.id)}
                              disabled={actionLoading}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
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

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Overwork Request Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && config && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Employee</p>
                  <p className="font-medium">{selectedEntry.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="capitalize">{selectedEntry.userRole}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Work Date</p>
                  <p>{new Date(selectedEntry.workDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hours Worked</p>
                  <p className="font-medium">{selectedEntry.hours} hours</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Potential Comp-Off</p>
                  <p className="font-medium text-green-600">
                    {Math.floor(selectedEntry.hours / config.conversionHours)} day(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ({config.conversionHours} hours = 1 day)
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedEntry.reason || "No reason provided"}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
            {selectedEntry && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => handleReject(selectedEntry.id)}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  onClick={() => handleApprove(selectedEntry.id)}
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