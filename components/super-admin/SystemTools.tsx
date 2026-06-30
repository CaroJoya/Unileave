// components/super-admin/SystemTools.tsx - COMPLETE FILE (ESLint Compliant)
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Database, 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  RefreshCw, 
  Search, 
  Wrench 
} from "lucide-react";

// Types for the broken balance tool
interface BrokenRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  totalDays: number;
  status: string;
  hasBalanceDoc: boolean;
  hasLeaveType: boolean;
  error?: string;
}

interface FixedRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  totalDays: number;
  msg: string;
}

interface FailedRequest {
  id: string;
  applicantId: string;
  applicantName: string;
  leaveType: string;
  totalDays: number;
  error: string;
}

interface BalanceFixResult {
  fixed: number;
  failed: number;
  totalFound: number;
  fixedRequests: FixedRequest[];
  failedRequests: FailedRequest[];
  details: string[];
  message: string;
}

// ============ SYSTEM TOOLS COMPONENT ============
export function SystemTools() {
  // State for Seed Leave Types
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasSeeded, setHasSeeded] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);

  // State for Validate Assignments
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    errors: string[];
    cleaned: string[];
    details: { invalidHODs: number; invalidRegistrars: number; invalidPrincipals: number };
  } | null>(null);

  // State for Fix Broken Balances
  const [isFinding, setIsFinding] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [brokenRequests, setBrokenRequests] = useState<BrokenRequest[]>([]);
  const [fixResult, setFixResult] = useState<BalanceFixResult | null>(null);
  const [showBrokenList, setShowBrokenList] = useState(false);

  // ============ SEED LEAVE TYPES ============
  const handleSeedLeaveTypes = async () => {
    setIsSeeding(true);
    setSeedResult(null);

    try {
      const response = await fetch("/api/admin/seed-leave-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (response.status === 409) {
        setSeedResult({
          success: false,
          message: data.message || "Leave types already exist",
          details: data.existing || [],
        });
        toast.warning("Leave types already exist");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to seed leave types");
      }

      setSeedResult({
        success: true,
        message: data.message || "Leave types seeded successfully",
        details: data.seeded || [],
      });
      setHasSeeded(true);
      toast.success("Leave types seeded successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to seed leave types";
      setSeedResult({
        success: false,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsSeeding(false);
    }
  };

  // ============ VALIDATE ASSIGNMENTS ============
  const handleValidateAssignments = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch("/api/super-admin/validate-assignments", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to validate assignments");
      }

      setValidationResult({
        errors: data.errors || [],
        cleaned: data.cleaned || [],
        details: data.details || { invalidHODs: 0, invalidRegistrars: 0, invalidPrincipals: 0 },
      });

      if (data.cleaned.length > 0) {
        toast.success(`Cleaned ${data.cleaned.length} invalid assignments`);
      } else if (data.errors.length === 0) {
        toast.success("✅ All assignments are valid!");
      } else {
        toast.warning(`Found ${data.errors.length} issues, ${data.cleaned.length} cleaned`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to validate";
      toast.error(errorMessage);
    } finally {
      setIsValidating(false);
    }
  };

  // ============ FIX BROKEN BALANCES ============
  const handleFindBroken = async () => {
    setIsFinding(true);
    setBrokenRequests([]);
    setFixResult(null);
    
    try {
      const response = await fetch("/api/super-admin/fix-broken-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "find" }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to find broken requests");
      }
      
      setBrokenRequests(data.brokenRequests || []);
      setShowBrokenList(true);
      
      if (data.count === 0) {
        toast.success("✅ No broken balances found!");
      } else {
        toast.info(`Found ${data.count} broken request(s)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to find broken requests";
      toast.error(errorMessage);
    } finally {
      setIsFinding(false);
    }
  };

  const handleFixBroken = async () => {
    setIsFixing(true);
    setFixResult(null);
    
    try {
      const response = await fetch("/api/super-admin/fix-broken-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fix" }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to fix broken balances");
      }
      
      setFixResult(data);
      
      if (data.fixed > 0) {
        toast.success(`✅ Fixed ${data.fixed} broken balance(s)`);
      } else if (data.totalFound === 0) {
        toast.success("✅ No broken balances to fix!");
      } else {
        toast.warning(`Fixed ${data.fixed}, failed ${data.failed}`);
      }
      
      // Refresh the broken list after fixing
      setTimeout(() => {
        handleFindBroken();
      }, 1000);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fix balances";
      toast.error(errorMessage);
    } finally {
      setIsFixing(false);
    }
  };

  // ============ RENDER ============
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>System Tools</CardTitle>
        </div>
        <CardDescription>
          Seed default system data, validate role assignments, and fix broken leave balances
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* ========== 1. SEED LEAVE TYPES ========== */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">📊 Seed Leave Types</h3>
              <p className="text-sm text-muted-foreground">
                Create default leave types (CL, EL, ML, CO, OD, MAT, PAT, SPL) with proper configurations.
                Only run if no leave types exist.
              </p>
            </div>
            <Button
              onClick={handleSeedLeaveTypes}
              disabled={isSeeding || hasSeeded}
              className="shrink-0"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Seeding...
                </>
              ) : hasSeeded ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Seeded
                </>
              ) : (
                "Seed Leave Types"
              )}
            </Button>
          </div>

          {/* Seed Result */}
          {seedResult && (
            <div
              className={`rounded-lg p-4 ${
                seedResult.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-amber-50 border border-amber-200"
              }`}
            >
              <div className="flex items-start gap-2">
                {seedResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      seedResult.success ? "text-green-800" : "text-amber-800"
                    }`}
                  >
                    {seedResult.message}
                  </p>
                  {seedResult.details && seedResult.details.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {seedResult.details.map((detail, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          • {detail}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========== 2. VALIDATE ASSIGNMENTS ========== */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                Validate &amp; Clean Assignments
              </h3>
              <p className="text-sm text-muted-foreground">
                Check and clean invalid HOD, Registrar, and Principal assignments.
                This will remove assignments to deleted or deactivated users.
              </p>
            </div>
            <Button
              onClick={handleValidateAssignments}
              disabled={isValidating}
              variant="outline"
              className="shrink-0"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Validate & Clean"
              )}
            </Button>
          </div>

          {validationResult && (
            <div
              className={`rounded-lg p-4 ${
                validationResult.errors.length === 0 && validationResult.cleaned.length === 0
                  ? "bg-green-50 border border-green-200"
                  : validationResult.cleaned.length > 0
                  ? "bg-blue-50 border border-blue-200"
                  : "bg-yellow-50 border border-yellow-200"
              }`}
            >
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Invalid HODs</p>
                  <p className={`text-lg font-bold ${
                    validationResult.details.invalidHODs > 0 ? "text-red-600" : "text-green-600"
                  }`}>
                    {validationResult.details.invalidHODs}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Invalid Registrars</p>
                  <p className={`text-lg font-bold ${
                    validationResult.details.invalidRegistrars > 0 ? "text-red-600" : "text-green-600"
                  }`}>
                    {validationResult.details.invalidRegistrars}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Invalid Principals</p>
                  <p className={`text-lg font-bold ${
                    validationResult.details.invalidPrincipals > 0 ? "text-red-600" : "text-green-600"
                  }`}>
                    {validationResult.details.invalidPrincipals}
                  </p>
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-yellow-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Found {validationResult.errors.length} issues:
                  </p>
                  <ul className="mt-1 space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <li key={index} className="text-sm text-yellow-700">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.cleaned.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-blue-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Cleaned {validationResult.cleaned.length} assignments:
                  </p>
                  <ul className="mt-1 space-y-1">
                    {validationResult.cleaned.map((item, index) => (
                      <li key={index} className="text-sm text-blue-700">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.errors.length === 0 && validationResult.cleaned.length === 0 && (
                <p className="text-green-800 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  ✅ All assignments are valid!
                </p>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">⚠️ Important</p>
                <p className="text-sm text-amber-700 mt-1">
                  This tool will remove assignments to users who have been deleted or deactivated.
                  This action is logged for audit purposes and cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== 3. FIX BROKEN BALANCES ========== */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Wrench className="h-5 w-5 text-amber-500" />
                Fix Broken Leave Balances
              </h3>
              <p className="text-sm text-muted-foreground">
                Find and fix cancelled leave requests where the balance was not restored.
                This tool will restore the leave days to the user&apos;s balance.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleFindBroken}
                disabled={isFinding || isFixing}
                variant="outline"
                size="sm"
              >
                {isFinding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Broken
                  </>
                )}
              </Button>
              <Button
                onClick={handleFixBroken}
                disabled={isFixing || brokenRequests.length === 0}
                variant="default"
                size="sm"
                className="bg-amber-500 hover:bg-amber-600"
              >
                {isFixing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wrench className="mr-2 h-4 w-4" />
                    Fix All ({brokenRequests.length})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Show broken requests */}
          {showBrokenList && brokenRequests.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium text-sm mb-2">Broken Requests Found:</h4>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left p-2">User</th>
                      <th className="text-left p-2">Leave Type</th>
                      <th className="text-left p-2">Days</th>
                      <th className="text-left p-2">Balance Exists?</th>
                      <th className="text-left p-2">Leave Type Exists?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brokenRequests.map((req) => (
                      <tr key={req.id} className="border-t">
                        <td className="p-2">{req.applicantName || req.applicantId}</td>
                        <td className="p-2">{req.leaveType}</td>
                        <td className="p-2">{req.totalDays}</td>
                        <td className="p-2">
                          {req.hasBalanceDoc ? (
                            <span className="text-green-600">✅ Yes</span>
                          ) : (
                            <span className="text-red-600">❌ No</span>
                          )}
                        </td>
                        <td className="p-2">
                          {req.hasLeaveType ? (
                            <span className="text-green-600">✅ Yes</span>
                          ) : (
                            <span className="text-red-600">❌ No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fix Result */}
          {fixResult && (
            <div className={`border rounded-lg p-4 ${
              fixResult.fixed > 0 ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
            }`}>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Found</p>
                  <p className="text-lg font-bold">{fixResult.totalFound}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Fixed</p>
                  <p className="text-lg font-bold text-green-600">{fixResult.fixed}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-lg font-bold text-red-600">{fixResult.failed}</p>
                </div>
              </div>

              {fixResult.fixedRequests.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-green-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Fixed {fixResult.fixedRequests.length} requests:
                  </p>
                  <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {fixResult.fixedRequests.map((item, index) => (
                      <li key={index} className="text-sm text-green-700">
                        {item.msg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fixResult.failedRequests.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-red-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Failed {fixResult.failedRequests.length} requests:
                  </p>
                  <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {fixResult.failedRequests.map((item, index) => (
                      <li key={index} className="text-sm text-red-700">
                        {item.applicantName} - {item.leaveType}: {item.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fixResult.totalFound === 0 && (
                <p className="text-green-800 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  ✅ No broken balances found!
                </p>
              )}
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">⚠️ Important</p>
                <p className="text-sm text-amber-700 mt-1">
                  This tool fixes requests that are marked as &quot;Cancelled&quot; but have
                  <strong> balanceRestored: false</strong>. It will restore the leave days to the user&apos;s balance.
                  If no balance exists, it will create one with default quotas.
                  All actions are logged for audit purposes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== FOOTER ========== */}
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            System tools help you maintain data integrity. All operations are logged for audit purposes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}