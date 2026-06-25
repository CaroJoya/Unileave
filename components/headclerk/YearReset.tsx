// components/headclerk/YearReset.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Calendar } from "lucide-react";

// ============ TYPES ============

interface CarryOverRule {
  leaveType: string;
  carryOver: boolean;
  maxCarryOver: number | null;
}

interface RoleAllocation {
  [leaveType: string]: number;
}

interface LeaveAllocations {
  [role: string]: RoleAllocation;
}

interface Policy {
  academicYear: string;
  leaveAllocations: LeaveAllocations;
  effectiveFrom: string;
  applyRule: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
}

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  details: string;
  createdAt: string;
}

interface YearResetData {
  currentAcademicYear: string;
  availableYears: string[];
  leaveTypes: string[];
  policies: Policy[];
  lastReset: AuditLog | null;
  hasReset: boolean;
}

// ============ CONSTANTS ============

const ROLES = ["faculty", "lab_assistant", "office_staff", "hod", "registrar", "principal", "head_clerk"];

const ROLE_LABELS: Record<string, string> = {
  faculty: "Faculty",
  lab_assistant: "Lab Assistant",
  office_staff: "Office Staff",
  hod: "HOD",
  registrar: "Registrar",
  principal: "Principal",
  head_clerk: "Head Clerk",
};

// ============ COMPONENT ============

export function YearReset() {
  const [loading, setLoading] = useState(true);
  const [resetData, setResetData] = useState<YearResetData | null>(null);
  const [selectedYear, setSelectedYear] = useState("");
  const [resetAction, setResetAction] = useState<"continue" | "modify">("continue");
  const [carryOverRules, setCarryOverRules] = useState<CarryOverRule[]>([]);
  const [allocations, setAllocations] = useState<LeaveAllocations>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  const hasFetched = useRef(false);

  // ============ FETCH DATA ============

  const fetchResetData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/headclerk/year-reset");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch reset data");
      }

      setResetData(data);
      setSelectedYear(data.availableYears[0] || "");

      // Initialize carry-over rules for all leave types
      const rules: CarryOverRule[] = data.leaveTypes.map((type: string) => ({
        leaveType: type,
        carryOver: false,
        maxCarryOver: null,
      }));
      setCarryOverRules(rules);

      // Initialize allocations from current policy
      if (data.policies.length > 0) {
        const currentPolicy = data.policies.find(
          (p: Policy) => p.academicYear === data.currentAcademicYear
        );
        if (currentPolicy?.leaveAllocations) {
          setAllocations(currentPolicy.leaveAllocations);
        }
      }
    } catch (error) {
      console.error("Error fetching reset data:", error);
      toast.error("Failed to fetch reset data");
    } finally {
      setLoading(false);
    }
  }, []);

  // ============ EFFECTS ============

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchResetData();
    }
  }, [fetchResetData]);

  // ============ HANDLERS ============

  const handleCarryOverToggle = useCallback((leaveType: string) => {
    setCarryOverRules((prevRules) =>
      prevRules.map((rule) =>
        rule.leaveType === leaveType ? { ...rule, carryOver: !rule.carryOver } : rule
      )
    );
  }, []);

  const handleMaxCarryOverChange = useCallback((leaveType: string, value: string) => {
    setCarryOverRules((prevRules) =>
      prevRules.map((rule) =>
        rule.leaveType === leaveType ? { ...rule, maxCarryOver: value ? parseFloat(value) : null } : rule
      )
    );
  }, []);

  const handleAllocationChange = useCallback((role: string, leaveType: string, value: string) => {
    setAllocations((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [leaveType]: parseFloat(value) || 0,
      },
    }));
  }, []);

  // ============ RESET EXECUTION ============

  const handleReset = useCallback(async () => {
    if (confirmationText !== "CONFIRM") {
      toast.error('Please type "CONFIRM" to proceed');
      return;
    }

    setIsExecuting(true);
    try {
      const payload: {
        action: "continue" | "modify";
        newAcademicYear: string;
        carryOverRules: CarryOverRule[];
        confirmation: boolean;
        leaveAllocations?: LeaveAllocations;
      } = {
        action: resetAction,
        newAcademicYear: selectedYear,
        carryOverRules,
        confirmation: true,
      };

      if (resetAction === "modify") {
        payload.leaveAllocations = allocations;
      }

      const response = await fetch("/api/headclerk/year-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute year reset");
      }

      toast.success(`Year reset to ${selectedYear} completed successfully!`);
      toast.info(`✅ ${data.usersAffected} users notified`);

      setShowConfirmDialog(false);
      setConfirmationText("");

      await fetchResetData();

      toast.success("📊 New balances have been created for all active users");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to execute year reset";
      toast.error(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  }, [confirmationText, resetAction, selectedYear, carryOverRules, allocations, fetchResetData]);

  // ============ RENDER ============

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!resetData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <p>Unable to load year reset data. Please try again.</p>
          <Button className="mt-4" onClick={fetchResetData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Year Reset
          </h2>
          <p className="text-muted-foreground mt-1">
            Current Academic Year: <strong>{resetData.currentAcademicYear}</strong>
          </p>
        </div>
        {resetData.hasReset && resetData.lastReset && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Last reset: {new Date(resetData.lastReset.createdAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Step 1: Select Academic Year */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select New Academic Year</CardTitle>
          <CardDescription>
            Choose the academic year for which you want to reset leave balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label>New Academic Year</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {resetData.availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedYear === resetData.currentAcademicYear && (
              <p className="text-amber-600 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                You are selecting the current academic year. This will reset all balances.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Choose Action */}
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Choose Policy Action</CardTitle>
          <CardDescription>
            Decide whether to continue with the current policy or modify allocations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={resetAction === "continue" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setResetAction("continue")}
              >
                Continue with Same Policy
              </Button>
              <Button
                variant={resetAction === "modify" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setResetAction("modify")}
              >
                Modify Policy
              </Button>
            </div>

            {resetAction === "modify" && (
              <div className="border rounded-lg p-4 mt-4">
                <h4 className="font-medium mb-3">Leave Allocations for {selectedYear}</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        {resetData.leaveTypes.map((type) => (
                          <TableHead key={type} className="text-center">
                            {type}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ROLES.map((role) => (
                        <TableRow key={role}>
                          <TableCell className="font-medium">{ROLE_LABELS[role] || role}</TableCell>
                          {resetData.leaveTypes.map((type) => (
                            <TableCell key={`${role}-${type}`} className="text-center">
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={allocations[role]?.[type] || 0}
                                onChange={(e) => handleAllocationChange(role, type, e.target.value)}
                                className="w-20 text-center mx-auto"
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Carry-Over Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Step 3: Configure Carry-Over Rules</CardTitle>
          <CardDescription>
            Select which leave types can be carried over to the new academic year
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead className="text-center">Carry Over</TableHead>
                  <TableHead className="text-center">Max Carry Over (Days)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resetData.leaveTypes.map((type) => {
                  const rule = carryOverRules.find((r) => r.leaveType === type);
                  return (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{type}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={rule?.carryOver || false}
                          onCheckedChange={() => handleCarryOverToggle(type)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="No limit"
                          value={rule?.maxCarryOver ?? ""}
                          onChange={(e) => handleMaxCarryOverChange(type, e.target.value)}
                          disabled={!rule?.carryOver}
                          className="w-24 text-center mx-auto"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Leave types not marked for carry-over will lapse at the end of the academic year.
          </p>
        </CardContent>
      </Card>

      {/* Step 4: Confirmation Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Step 4: Review & Confirm</CardTitle>
          <CardDescription>
            Review the changes before applying them
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">⚠️ This action will:</p>
                <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Create a new leave policy for {selectedYear}</li>
                  <li>
                    {resetAction === "continue"
                      ? "Keep the same leave allocations"
                      : "Apply modified leave allocations"}
                  </li>
                  <li>
                    {carryOverRules.some((r) => r.carryOver)
                      ? `Carry over unused leave for: ${carryOverRules
                          .filter((r) => r.carryOver)
                          .map((r) => r.leaveType)
                          .join(", ")}`
                      : "No leave will be carried over"}
                  </li>
                  <li>Reset balances for all active users</li>
                  <li>Archive the current policy</li>
                  <li>Send notifications to all users</li>
                </ul>
                <p className="text-sm text-amber-800 font-medium mt-4">
                  ⚡ This action cannot be undone!
                </p>
              </div>
            </div>
          </div>

          <Button className="w-full mt-6" onClick={() => setShowConfirmDialog(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Execute Year Reset
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Year Reset</DialogTitle>
            <DialogDescription>
              You are about to reset the academic year to {selectedYear}. This action is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">⚠️ Please confirm the following:</p>
              <ul className="text-sm text-red-700 mt-2 space-y-1 list-disc list-inside">
                <li>All leave balances will be reset for all users</li>
                <li>Previous year policy will be archived</li>
                <li>All users will be notified</li>
                <li>This action is irreversible</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label>
                Type <strong className="text-red-600">CONFIRM</strong> to proceed
              </Label>
              <Input
                placeholder="Type CONFIRM"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value.toUpperCase())}
                className="border-red-200 focus:border-red-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={isExecuting || confirmationText !== "CONFIRM"}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Execute Reset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}