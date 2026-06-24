// components/super-admin/SystemTools.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Database, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export function SystemTools() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [hasSeeded, setHasSeeded] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <CardTitle>System Tools</CardTitle>
        </div>
        <CardDescription>
          Seed default system data for quick setup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
            <div className={`rounded-lg p-4 ${
              seedResult.success 
                ? "bg-green-50 border border-green-200" 
                : "bg-amber-50 border border-amber-200"
            }`}>
              <div className="flex items-start gap-2">
                {seedResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className={`font-medium ${
                    seedResult.success ? "text-green-800" : "text-amber-800"
                  }`}>
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

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">⚠️ Important</p>
                <p className="text-sm text-amber-700 mt-1">
                  This will create the 8 default leave types. Run only once during initial setup.
                  If leave types already exist, this action will be skipped.
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