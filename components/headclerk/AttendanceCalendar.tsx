"use client";

import { useState, useEffect, useCallback } from "react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { toast } from "sonner";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  MinusCircle,
  Download,
  FileText, 
  Loader2, 
  UserCheck 
} from "lucide-react";
import type { Department, StaffUser, AttendanceRecord } from "@/types/attendance";
import { EmployeeLeaveCard } from "./EmployeeLeaveCard";

interface AttendanceCalendarProps {
  departments: Department[];
  staffUsers: StaffUser[];
  onRefresh: () => void;
}

interface EmployeeSummary {
  uid: string;
  name: string;
  employeeId: string;
  departmentName: string;
  designation: string;
}

// Dynamically extract the exact 'data' prop type expected by EmployeeLeaveCard
// and combine it with the API response fields to satisfy both ESLint and TypeScript
type ExpectedCardData = ComponentProps<typeof EmployeeLeaveCard>["data"];
type LeaveCardData = ExpectedCardData & {
  success?: boolean;
  error?: string;
};

export function AttendanceCalendar({ departments, staffUsers, onRefresh }: AttendanceCalendarProps) {
  // --- ORIGINAL ATTENDANCE STATES ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [filters, setFilters] = useState({
    departmentId: "",
    userId: "",
  });
  const [markForm, setMarkForm] = useState({
    status: "Present",
    halfDaySession: "First Half",
    remarks: "",
  });
  const [saving, setSaving] = useState(false);

  // --- NEW LEAVE CARD STATES ---
  const [cardEmployees, setCardEmployees] = useState<EmployeeSummary[]>([]);
  const [selectedCardUserId, setSelectedCardUserId] = useState<string>("");
  const [loadingCardEmployees, setLoadingCardEmployees] = useState<boolean>(true);
  const [loadingCard, setLoadingCard] = useState<boolean>(false);
  
  // State typed perfectly to match the child component's props
  const [cardData, setCardData] = useState<LeaveCardData | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // --- ORIGINAL ATTENDANCE LOGIC ---
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        month: (month + 1).toString(),
      });
      if (filters.departmentId) params.append("departmentId", filters.departmentId);
      if (filters.userId) params.append("userId", filters.userId);

      const response = await fetch(`/api/headclerk/attendance?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch attendance");
      }

      setAttendance(data.attendance || []);
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
      toast.error("Failed to fetch attendance");
    } finally {
      setLoading(false);
    }
  }, [year, month, filters.departmentId, filters.userId]);

  useEffect(() => {
    const loadAttendance = async () => {
      await fetchAttendance();
    };
    loadAttendance();
  }, [fetchAttendance]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    const startWeekday = firstDay.getDay();
    for (let i = 0; i < startWeekday; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getAttendanceForDateAndUser = (date: Date, userId: string): AttendanceRecord | null => {
    const dateStr = date.toISOString().split("T")[0];
    return attendance.find(
      (record) => record.date?.split("T")[0] === dateStr && record.userId === userId
    ) || null;
  };

  const handleDateClick = (date: Date, user: StaffUser) => {
    setSelectedDate(date);
    setSelectedUser(user);
    
    const existing = getAttendanceForDateAndUser(date, user.uid);
    if (existing) {
      setMarkForm({
        status: existing.status,
        halfDaySession: existing.halfDaySession || "First Half",
        remarks: existing.remarks || "",
      });
    } else {
      setMarkForm({
        status: "Present",
        halfDaySession: "First Half",
        remarks: "",
      });
    }
    
    setShowMarkDialog(true);
  };

  const handleSaveAttendance = async () => {
    if (!selectedDate || !selectedUser) return;
    
    setSaving(true);
    try {
      const response = await fetch("/api/headclerk/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.uid,
          date: selectedDate.toISOString().split("T")[0],
          status: markForm.status,
          remarks: markForm.remarks,
          halfDaySession: markForm.status === "Half Day" ? markForm.halfDaySession : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save attendance");
      }

      toast.success(`Attendance marked as ${markForm.status}`);
      setShowMarkDialog(false);
      fetchAttendance();
      onRefresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        year: year.toString(),
        month: (month + 1).toString(),
        format: "csv",
      });
      if (filters.departmentId) params.append("departmentId", filters.departmentId);
      
      const response = await fetch(`/api/headclerk/attendance/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to export");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${year}-${(month + 1).toString().padStart(2, "0")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("Attendance exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export attendance");
    }
  };

  const filteredStaff = filters.departmentId
    ? staffUsers.filter(u => u.departmentId === filters.departmentId)
    : staffUsers;


  // --- NEW LEAVE CARD LOGIC ---
  useEffect(() => {
    async function fetchEmployeesForCard() {
      try {
        const res = await fetch("/api/headclerk/employee-leave-card");
        const json = await res.json();
        if (json.success && json.employees) {
          setCardEmployees(json.employees);
          if (json.employees.length > 0) {
            setSelectedCardUserId(json.employees[0].uid);
          }
        }
      } catch (err) {
        console.error("Failed to load employee list:", err);
      } finally {
        setLoadingCardEmployees(false);
      }
    }
    fetchEmployeesForCard();
  }, []);

  const handleGenerateCard = async () => {
    if (!selectedCardUserId) {
      toast.error("Please select an employee");
      return;
    }
    setLoadingCard(true);
    try {
      const res = await fetch(`/api/headclerk/employee-leave-card?userId=${selectedCardUserId}`);
      const json = await res.json();
      if (json.success) {
        setCardData(json);
        toast.success(`Generated leave card for ${json.employee.name}`);
      } else {
        toast.error(json.error || "Failed to generate card");
      }
    } catch (err) {
      console.error("Error generating leave card:", err);
      toast.error("Error generating leave card");
    } finally {
      setLoadingCard(false);
    }
  };

  // If a card is generated, show ONLY the card (with a back button)
  if (cardData) {
    return <EmployeeLeaveCard data={cardData} onBack={() => setCardData(null)} />;
  }

  return (
    <div className="space-y-8">
      {/* --- NEW: EMPLOYEE LEAVE CARD GENERATOR BAR --- */}
      <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
            <FileText className="w-5 h-5 text-indigo-600" />
            Employee Service Leave Record & Attendance Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                Select Employee to Generate Official Leave Card
              </label>
              {loadingCardEmployees ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  Loading employees...
                </div>
              ) : (
                <Select value={selectedCardUserId} onValueChange={setSelectedCardUserId}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cardEmployees.map((emp) => (
                      <SelectItem key={emp.uid} value={emp.uid}>
                        {emp.name} ({emp.employeeId}) - {emp.departmentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              onClick={handleGenerateCard}
              disabled={loadingCard || !selectedCardUserId}
              className="mt-auto bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {loadingCard ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              Generate Leave Card
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* --- ORIGINAL: ATTENDANCE TRACKER SECTION --- */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight">Daily Attendance Tracking</h2>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <Label>Department</Label>
            <Select
              value={filters.departmentId || "all"}
              onValueChange={(value) => setFilters({ ...filters, departmentId: value === "all" ? "" : value, userId: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-64">
            <Label>Staff Member</Label>
            <Select
              value={filters.userId || "all"}
              onValueChange={(value) => setFilters({ ...filters, userId: value === "all" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {filteredStaff.map((user) => (
                  <SelectItem key={user.uid} value={user.uid}>
                    {user.name} ({user.departmentName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Half Day</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-300"></div>
            <span>Not Marked</span>
          </div>
        </div>

        {/* Attendance Table */}
        {loading ? (
          <div className="text-center py-12">Loading attendance data...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No staff members found in the selected department.
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white min-w-[180px]">Staff</TableHead>
                  {days.map((day, index) => (
                    <TableHead key={index} className="min-w-[80px] text-center">
                      {day ? (
                        <div>
                          <div className="font-medium">{day.getDate()}</div>
                          <div className="text-xs text-muted-foreground">{weekdays[day.getDay()]}</div>
                        </div>
                      ) : null}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((staff) => (
                  <TableRow key={staff.uid}>
                    <TableCell className="sticky left-0 bg-white font-medium">
                      <div>{staff.name}</div>
                      <div className="text-xs text-muted-foreground">{staff.departmentName}</div>
                    </TableCell>
                    {days.map((day, colIndex) => (
                      <TableCell key={colIndex} className="text-center p-1">
                        {day && (
                          <button
                            onClick={() => handleDateClick(day, staff)}
                            className={`w-10 h-10 rounded-full transition-colors hover:opacity-80 ${
                              getAttendanceForDateAndUser(day, staff.uid)?.status === "Present"
                                ? "bg-green-100 text-green-800"
                                : getAttendanceForDateAndUser(day, staff.uid)?.status === "Absent"
                                ? "bg-red-100 text-red-800"
                                : getAttendanceForDateAndUser(day, staff.uid)?.status === "Half Day"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            {getAttendanceForDateAndUser(day, staff.uid)?.status === "Present" && (
                              <CheckCircle className="h-5 w-5 mx-auto text-green-600" />
                            )}
                            {getAttendanceForDateAndUser(day, staff.uid)?.status === "Absent" && (
                              <XCircle className="h-5 w-5 mx-auto text-red-600" />
                            )}
                            {getAttendanceForDateAndUser(day, staff.uid)?.status === "Half Day" && (
                              <MinusCircle className="h-5 w-5 mx-auto text-yellow-600" />
                            )}
                            {!getAttendanceForDateAndUser(day, staff.uid) && (
                              <span className="text-xs">-</span>
                            )}
                          </button>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mark Attendance Dialog */}
      <Dialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Attendance</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} - {selectedDate?.toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="Present"
                    checked={markForm.status === "Present"}
                    onChange={(e) => setMarkForm({ ...markForm, status: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span>Present</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="Absent"
                    checked={markForm.status === "Absent"}
                    onChange={(e) => setMarkForm({ ...markForm, status: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span>Absent</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="Half Day"
                    checked={markForm.status === "Half Day"}
                    onChange={(e) => setMarkForm({ ...markForm, status: e.target.value })}
                    className="w-4 h-4"
                  />
                  <span>Half Day</span>
                </label>
              </div>
            </div>

            {markForm.status === "Half Day" && (
              <div className="space-y-2">
                <Label>Session</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="First Half"
                      checked={markForm.halfDaySession === "First Half"}
                      onChange={(e) => setMarkForm({ ...markForm, halfDaySession: e.target.value })}
                      className="w-4 h-4"
                    />
                    <span>First Half</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="Second Half"
                      checked={markForm.halfDaySession === "Second Half"}
                      onChange={(e) => setMarkForm({ ...markForm, halfDaySession: e.target.value })}
                      className="w-4 h-4"
                    />
                    <span>Second Half</span>
                  </label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Input
                value={markForm.remarks}
                onChange={(e) => setMarkForm({ ...markForm, remarks: e.target.value })}
                placeholder="Add remarks..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAttendance} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}