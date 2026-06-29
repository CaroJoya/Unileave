"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Download, Search, RefreshCw } from "lucide-react";
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
};

export function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    action: "",
    module: "",
    userId: "",
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.action) params.append("action", filters.action);
      if (filters.module) params.append("module", filters.module);
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
    fetchLogs();
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
            return details.reason || details.remark || "-";
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

  const resetFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      action: "",
      module: "",
      userId: "",
    });
  };

  if (loading) {
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold">Audit Logs</h2>
            <p className="text-sm text-muted-foreground">
              Track all critical actions across the system
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
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
                <SelectItem value="">All actions</SelectItem>
                <SelectItem value="USER_CREATED">User Created</SelectItem>
                <SelectItem value="USER_DEACTIVATED">User Deactivated</SelectItem>
                <SelectItem value="USER_RESTORED">User Restored</SelectItem>
                <SelectItem value="USER_DELETED">User Deleted</SelectItem>
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
                <SelectItem value="">All modules</SelectItem>
                <SelectItem value="users">Users</SelectItem>
                <SelectItem value="leaveRequests">Leave Requests</SelectItem>
                <SelectItem value="compOffCredits">Comp-Off</SelectItem>
                <SelectItem value="overworkEntries">Overwork</SelectItem>
                <SelectItem value="leavePolicies">Leave Policies</SelectItem>
                <SelectItem value="leaveTypes">Leave Types</SelectItem>
                <SelectItem value="overworkConfig">Overwork Config</SelectItem>
                <SelectItem value="vacationPeriods">Vacation Periods</SelectItem>
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
          <Button size="sm" onClick={fetchLogs}>
            <Search className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
        </div>

        {/* Audit Logs Table */}
        {logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No audit logs found.
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
                          return details.reason || details.remark || "-";
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
    </Card>
  );
}