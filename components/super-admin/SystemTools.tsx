// components/super-admin/SystemTools.tsx - COMPLETE FIXED FILE
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, AlertCircle, CheckCircle, Loader2, Shield } from "lucide-react";

interface ValidationResult {
  errors: string[];
  cleaned: string[];
  details: {
    invalidHODs: number;
    invalidRegistrars: number;
    invalidPrincipals: number;
  };
}

export function SystemTools() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasSeeded, setHasSeeded] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);

  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

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
        // Already exists
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>System Tools</CardTitle>
        </div>
        <CardDescription>
          Seed default system data and validate role assignments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Seed Leave Types */}
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

        {/* Validate Assignments */}
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Validate & Clean Assignments
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

        {/* Footer */}
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            System tools help you quickly set up the application with default data.
            All operations are logged for audit purposes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}