// components/registrar/YearEndReport.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, FileText, Loader2 } from "lucide-react";

// ============ TYPES ============

interface LeaveTypeBreakdown {
  count: number;
  totalDays: number;
}

interface DepartmentBreakdown {
  total: number;
  approved: number;
  totalDays: number;
}

interface CarryOverByType {
  carriedOver: number;
  lapsed: number;
}

interface CarryOverSummary {
  totalCarriedOver: number;
  totalLapsed: number;
  byType: Record<string, CarryOverByType>;
}

interface TopTaker {
  name: string;
  department: string;
  days: number;
}

interface YearEndReportData {
  academicYear: string;
  generatedAt: string;
  summary: {
    totalRequests: number;
    totalApproved: number;
    totalRejected: number;
    totalDays: number;
    approvalRate: string;
  };
  leaveTypeBreakdown: Record<string, LeaveTypeBreakdown>;
  departmentBreakdown: Record<string, DepartmentBreakdown>;
  carryOverSummary: CarryOverSummary;
  topTakers: TopTaker[];
  newYearPolicy: {
    academicYear: string;
    allocations: Record<string, Record<string, number>>;
  } | null;
}

// ============ COMPONENT ============

export function YearEndReport() {
  const [loading, setLoading] = useState(false);
  const [academicYear, setAcademicYear] = useState("");
  const [report, setReport] = useState<YearEndReportData | null>(null);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  const hasFetchedYears = useRef(false);

  // ============ FETCH FUNCTIONS ============

  const fetchAvailableYears = useCallback(async () => {
    try {
      const response = await fetch("/api/registrar/reports/available-years");
      const data = await response.json();
      if (data.years) {
        setAvailableYears(data.years);
        if (data.years.length > 0) {
          setAcademicYear(data.years[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch available years:", error);
      toast.error("Failed to fetch available years");
    }
  }, []);

  const fetchReport = useCallback(async () => {
    if (!academicYear) {
      toast.error("Please select an academic year");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/registrar/reports/year-end?academicYear=${academicYear}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch report");
      }

      setReport(data.report);
      toast.success("Report loaded successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch report";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [academicYear]);

  // ============ EFFECTS ============

  useEffect(() => {
    if (!hasFetchedYears.current) {
      hasFetchedYears.current = true;
      fetchAvailableYears();
    }
  }, [fetchAvailableYears]);

  // ============ EXPORT FUNCTIONS ============

  const exportToCSV = useCallback(() => {
    if (!report) return;

    // Generate CSV from report data
    const rows: string[][] = [
      ["Academic Year", report.academicYear],
      ["Generated At", new Date(report.generatedAt).toLocaleString()],
      [],
      ["SUMMARY"],
      ["Total Requests", report.summary.totalRequests.toString()],
      ["Total Approved", report.summary.totalApproved.toString()],
      ["Total Rejected", report.summary.totalRejected.toString()],
      ["Total Days", report.summary.totalDays.toString()],
      ["Approval Rate", report.summary.approvalRate],
      [],
      ["LEAVE TYPE BREAKDOWN"],
      ["Leave Type", "Count", "Total Days"],
    ];

    for (const [type, data] of Object.entries(report.leaveTypeBreakdown)) {
      rows.push([type, data.count.toString(), data.totalDays.toString()]);
    }

    rows.push([]);
    rows.push(["DEPARTMENT BREAKDOWN"]);
    rows.push(["Department", "Total Requests", "Approved", "Total Days"]);

    for (const [dept, data] of Object.entries(report.departmentBreakdown)) {
      rows.push([dept, data.total.toString(), data.approved.toString(), data.totalDays.toString()]);
    }

    rows.push([]);
    rows.push(["CARRY-OVER SUMMARY"]);
    rows.push(["Leave Type", "Carried Over", "Lapsed"]);

    for (const [type, data] of Object.entries(report.carryOverSummary.byType)) {
      rows.push([type, data.carriedOver.toString(), data.lapsed.toString()]);
    }

    rows.push([]);
    rows.push(["TOP 5 LEAVE TAKERS"]);
    rows.push(["#", "Name", "Department", "Days"]);

    report.topTakers.forEach((taker, index) => {
      rows.push([(index + 1).toString(), taker.name, taker.department, taker.days.toString()]);
    });

    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `year_end_report_${report.academicYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Report exported successfully");
  }, [report]);

  // ============ RENDER ============

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Academic Year</Label>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchReport} disabled={loading || !academicYear}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
              <Button variant="outline" onClick={exportToCSV} disabled={!report}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {report ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{report.summary.totalRequests}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {report.summary.totalApproved}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">
                  {report.summary.totalRejected}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Days</p>
                <p className="text-2xl font-bold">{report.summary.totalDays}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <p className="text-2xl font-bold text-primary">
                  {report.summary.approvalRate}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Leave Type Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Leave Type Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Total Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.leaveTypeBreakdown).map(([type, data]) => (
                    <TableRow key={type}>
                      <TableCell>{type}</TableCell>
                      <TableCell className="text-right">{data.count}</TableCell>
                      <TableCell className="text-right">{data.totalDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Department Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Department Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Total Requests</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">Total Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.departmentBreakdown).map(([dept, data]) => (
                    <TableRow key={dept}>
                      <TableCell>{dept}</TableCell>
                      <TableCell className="text-right">{data.total}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {data.approved}
                      </TableCell>
                      <TableCell className="text-right">{data.totalDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Carry-Over Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Carry-Over Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-700">Total Carried Over</p>
                  <p className="text-3xl font-bold text-green-600">
                    {report.carryOverSummary.totalCarriedOver} days
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-red-700">Total Lapsed</p>
                  <p className="text-3xl font-bold text-red-600">
                    {report.carryOverSummary.totalLapsed} days
                  </p>
                </div>
              </div>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead className="text-right">Carried Over</TableHead>
                    <TableHead className="text-right">Lapsed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.carryOverSummary.byType).map(([type, data]) => (
                    <TableRow key={type}>
                      <TableCell>{type}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {data.carriedOver}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {data.lapsed}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top Takers */}
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Leave Takers</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Days Taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topTakers.map((taker, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{taker.name}</TableCell>
                      <TableCell>{taker.department}</TableCell>
                      <TableCell className="text-right font-bold">{taker.days}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* New Year Policy Preview */}
          {report.newYearPolicy && (
            <Card>
              <CardHeader>
                <CardTitle>New Year Policy Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Academic Year: <strong>{report.newYearPolicy.academicYear}</strong>
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      {Object.keys(report.newYearPolicy.allocations).length > 0 &&
                        Object.keys(
                          report.newYearPolicy.allocations[
                            Object.keys(report.newYearPolicy.allocations)[0]
                          ] || {}
                        ).map((type) => (
                          <TableHead key={type} className="text-right">
                            {type}
                          </TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(report.newYearPolicy.allocations).map(
                      ([role, allocations]) => (
                        <TableRow key={role}>
                          <TableCell className="font-medium capitalize">
                            {role.replace("_", " ")}
                          </TableCell>
                          {Object.values(allocations).map((value, idx) => (
                            <TableCell key={idx} className="text-right">
                              {value}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4" />
            <p>Select an academic year and click &quot;Generate Report&quot;</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}