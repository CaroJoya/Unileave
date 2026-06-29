"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Download, 
  Search, 
  RefreshCw,
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  targetId: string | null;
  targetUser: string | null;
  oldData: string | null;
  newData: string | null;
  details: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  USER_CREATED: "bg-green-100 text-green-800",
  USER_UPDATED: "bg-blue-100 text-blue-800",
  USER_DEACTIVATED: "bg-yellow-100 text-yellow-800",
  USER_RESTORED: "bg-green-100 text-green-800",
  USER_DELETED: "bg-red-100 text-red-800",
  ROLE_UNASSIGNED: "bg-orange-100 text-orange-800",
  AUDIT_LOGS_CLEARED: "bg-red-100 text-red-800",
  LEAVE_APPROVED: "bg-green-100 text-green-800",
  LEAVE_REJECTED: "bg-red-100 text-red-800",
  LEAVE_REMARKS_SENT: "bg-yellow-100 text-yellow-800",
  PRINCIPAL_OVERRIDE: "bg-orange-100 text-orange-800",
  COMP_OFF_APPROVED: "bg-green-100 text-green-800",
  OVERWORK_APPROVED: "bg-green-100 text-green-800",
  POLICY_CREATED: "bg-purple-100 text-purple-800",
  POLICY_UPDATED: "bg-purple-100 text-purple-800",
};

const MODULE_COLORS: Record<string, string> = {
  users: "bg-gray-100 text-gray-800",
  leaveRequests: "bg-indigo-100 text-indigo-800",
  compOffCredits: "bg-emerald-100 text-emerald-800",
  overworkEntries: "bg-amber-100 text-amber-800",
  leavePolicies: "bg-purple-100 text-purple-800",
  leaveTypes: "bg-purple-100 text-purple-800",
  overworkConfig: "bg-slate-100 text-slate-800",
  vacationPeriods: "bg-cyan-100 text-cyan-800",
  departments: "bg-gray-100 text-gray-800",
  auditLogs: "bg-red-100 text-red-800",
};

export function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearOption, setClearOption] = useState<"all" | "30" | "90" | "180">("30");
  const [isClearing, setIsClearing] = useState(false);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    action: "all",
    module: "all",
    userId: "",
  });

  const initialFetchDone = useRef(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.action && filters.action !== "all") params.append("action", filters.action);
      if (filters.module && filters.module !== "all") params.append("module", filters.module);
      if (filters.userId) params.append("userId", filters.userId);

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch audit logs");
      }

      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast.error("Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchLogs();
    }
  }, [fetchLogs]);

  const handleExport = () => {
    const headers = ["Date", "User", "Role", "Action", "Module", "Target", "Details"];
    const csvRows = [headers];
    
    for (const log of logs) {
      csvRows.push([
        new Date(log.createdAt).toLocaleString(),
        `${log.userName} (${log.userId})`,
        log.userRole,
        log.action,
        log.module,
        log.targetUser || log.targetId || "-",
        log.details ? (() => {
          try {
            const details = JSON.parse(log.details);
            return details.action || details.reason || details.remark || "-";
          } catch {
            return "-";
          }
        })() : "-",
      ]);
    }
    
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Audit logs exported successfully");
  };

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const days = clearOption === "all" ? "all" : clearOption;
      const response = await fetch(`/api/audit-logs/clear?olderThan=${days}`, {
        method: "DELETE",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to clear logs");
      }
      
      toast.success(`Cleared ${data.deletedCount} audit log(s)`);
      setShowClearDialog(false);
      await fetchLogs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to clear logs";
      toast.error(errorMessage);
    } finally {
      setIsClearing(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      action: "all",
      module: "all",
      userId: "",
    });
  };

  const handleRefresh = () => {
    fetchLogs();
  };

  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">Loading audit logs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-semibold">Audit Logs</h2>
            <p className="text-sm text-muted-foreground">
              Track all critical actions across the system
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleExport} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setShowClearDialog(true)}
              disabled={logs.length === 0 || loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Logs
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v })}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="USER_CREATED">User Created</SelectItem>
                <SelectItem value="USER_DEACTIVATED">User Deactivated</SelectItem>
                <SelectItem value="USER_RESTORED">User Restored</SelectItem>
                <SelectItem value="USER_DELETED">User Deleted</SelectItem>
                <SelectItem value="ROLE_UNASSIGNED">Role Unassigned</SelectItem>
                <SelectItem value="AUDIT_LOGS_CLEARED">Audit Logs Cleared</SelectItem>
                <SelectItem value="LEAVE_APPROVED">Leave Approved</SelectItem>
                <SelectItem value="LEAVE_REJECTED">Leave Rejected</SelectItem>
                <SelectItem value="PRINCIPAL_OVERRIDE">Principal Override</SelectItem>
                <SelectItem value="POLICY_CREATED">Policy Created</SelectItem>
                <SelectItem value="POLICY_UPDATED">Policy Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Module</Label>
            <Select value={filters.module} onValueChange={(v) => setFilters({ ...filters, module: v })}>
              <SelectTrigger>
                <SelectValue placeholder="All modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="leaveRequests">Leave Requests</SelectItem>
                <SelectItem value="compOffCredits">Comp-Off</SelectItem>
                <SelectItem value="overworkEntries">Overwork</SelectItem>
                <SelectItem value="leavePolicies">Leave Policies</SelectItem>
                <SelectItem value="leaveTypes">Leave Types</SelectItem>
                <SelectItem value="overworkConfig">Overwork Config</SelectItem>
                <SelectItem value="vacationPeriods">Vacation Periods</SelectItem>
                <SelectItem value="departments">Departments</SelectItem>
                <SelectItem value="auditLogs">Audit Logs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input
              placeholder="Filter by user ID..."
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-2 mb-6">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
          <Button size="sm" onClick={fetchLogs} disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            {loading ? 'Applying...' : 'Apply Filters'}
          </Button>
        </div>

        {/* Audit Logs Table */}
        {logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {loading ? 'Loading audit logs...' : 'No audit logs found.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.userName}</div>
                      <div className="text-xs text-muted-foreground">{log.userId.slice(0, 8)}...</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.userRole.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[log.action] || "bg-gray-100"}>
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={MODULE_COLORS[log.module] || "bg-gray-100"}>
                        {log.module}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.targetUser ? (
                        <span className="font-mono text-xs">{log.targetUser.slice(0, 12)}...</span>
                      ) : log.targetId ? (
                        <span className="font-mono text-xs">{log.targetId.slice(0, 12)}...</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {log.details ? (() => {
                        try {
                          const details = JSON.parse(log.details);
                          return details.action || details.reason || details.remark || "-";
                        } catch {
                          return "-";
                        }
                      })() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Clear Logs Dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Clear Audit Logs
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. Select which logs to delete.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delete logs older than:</Label>
              <Select 
                value={clearOption} 
                onValueChange={(v: "all" | "30" | "90" | "180") => setClearOption(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                  <SelectItem value="all">All logs (⚠️ Irreversible)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Warning:</strong> {clearOption === "all" 
                  ? "This will delete ALL audit logs. This action cannot be undone." 
                  : `This will delete audit logs older than ${clearOption} days.`}
              </p>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Current logs: <strong>{logs.length}</strong> entries
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClearLogs}
              disabled={isClearing}
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Logs
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}