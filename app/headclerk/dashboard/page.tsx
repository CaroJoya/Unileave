// app/headclerk/dashboard/page.tsx - COMPLETE FIXED FILE WITH ALL IMPROVEMENTS
"use client";

import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Sun, Snowflake, LayoutGrid, CalendarDays, Clock, Award, Users } from "lucide-react";
import { AttendanceCalendar } from "@/components/headclerk/AttendanceCalendar";
import { FacultyList } from "@/components/headclerk/FacultyList";
import { YearReset } from "@/components/headclerk/YearReset";
import { RoleNavbar } from "@/components/layout/RoleNavbar";
import type { Department, StaffUser } from "@/types/attendance";

// ============ TYPES ============

interface LeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  description: string;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  deductsBalance: boolean;
  hasExpiry: boolean;
  expiryInDays: number | null;
  maxConsecutiveDays: number | null;
  isActive: boolean;
}

interface Policy {
  academicYear: string;
  effectiveFrom: string;
  applyRule: string;
  isActive: boolean;
  leaveAllocations: {
    [key: string]: {
      CL: number;
      EL: number;
      ML: number;
      CO: number;
      MAT: number;
      PAT: number;
      SPL: number;
    };
  };
}

interface VacationPeriod {
  id: string;
  vacationType: string;
  year: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  paidLeaveQuota: number;
  isActive: boolean;
}

interface OverworkConfig {
  conversionHours: number;
  minHoursPerEntry: number;
  maxHoursPerDay: number;
  autoConversionEnabled: boolean;
}

type RoleKey = "faculty" | "lab_assistant" | "office_staff" | "hod" | "registrar" | "principal" | "head_clerk";

const roles: { id: RoleKey; label: string }[] = [
  { id: "faculty", label: "Faculty" },
  { id: "lab_assistant", label: "Lab Assistant" },
  { id: "office_staff", label: "Office Staff" },
  { id: "hod", label: "HOD" },
  { id: "registrar", label: "Registrar" },
  { id: "principal", label: "Principal" },
  { id: "head_clerk", label: "Head Clerk" },
];

// Default allocations with ALL 7 leave types
const defaultAllocations: Record<RoleKey, { CL: number; EL: number; ML: number; CO: number; MAT: number; PAT: number; SPL: number }> = {
  faculty: { CL: 24, EL: 12, ML: 15, CO: 10, MAT: 180, PAT: 15, SPL: 10 },
  lab_assistant: { CL: 18, EL: 10, ML: 15, CO: 8, MAT: 180, PAT: 15, SPL: 10 },
  office_staff: { CL: 20, EL: 10, ML: 15, CO: 8, MAT: 180, PAT: 15, SPL: 10 },
  hod: { CL: 24, EL: 15, ML: 15, CO: 10, MAT: 180, PAT: 15, SPL: 10 },
  registrar: { CL: 20, EL: 12, ML: 15, CO: 10, MAT: 180, PAT: 15, SPL: 10 },
  principal: { CL: 30, EL: 20, ML: 15, CO: 12, MAT: 180, PAT: 15, SPL: 10 },
  head_clerk: { CL: 20, EL: 12, ML: 15, CO: 10, MAT: 180, PAT: 15, SPL: 10 },
};

// Get initial tab from URL hash
const getInitialHeadClerkTab = (): string => {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['leave-types', 'leave-policies', 'year-reset', 'overwork', 'vacation', 'attendance', 'faculty'];
    if (hash && validTabs.includes(hash)) {
      return hash;
    }
  }
  return "leave-types";
};

function HeadClerkDashboardContent() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(getInitialHeadClerkTab);

  // Leave Types State
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    leaveCode: "",
    leaveName: "",
    description: "",
    allowHalfDay: false,
    requiresAttachment: false,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: "",
    maxConsecutiveDays: "",
    addToPolicy: false, // ✅ NEW: Auto-add to policy flag
  });

  // Edit Leave Type State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    leaveName: "",
    description: "",
    allowHalfDay: false,
    requiresAttachment: false,
    deductsBalance: true,
    hasExpiry: false,
    expiryInDays: "",
    maxConsecutiveDays: "",
  });

  // Leave Policies State
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    academicYear: "",
    applyRule: "immediate",
    leaveAllocations: { ...defaultAllocations },
  });

  // Overwork Config State
  const [overworkConfig, setOverworkConfig] = useState<OverworkConfig>({
    conversionHours: 5,
    minHoursPerEntry: 0.5,
    maxHoursPerDay: 24,
    autoConversionEnabled: true,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Vacation Periods State
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  const [showVacationDialog, setShowVacationDialog] = useState(false);
  const [editingVacation, setEditingVacation] = useState<VacationPeriod | null>(null);
  const [savingVacation, setSavingVacation] = useState(false);
  const [vacationForm, setVacationForm] = useState({
    vacationType: "Summer Vacation",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
    paidLeaveQuota: 27,
  });

  // Attendance State
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [attendanceKey, setAttendanceKey] = useState(0);

  // Handle tab change with hash
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // ========== LEAVE TYPES FUNCTIONS ==========
  const fetchLeaveTypes = useCallback(async () => {
    try {
      const response = await fetch("/api/headclerk/leave-types");
      const data = await response.json();
      setLeaveTypes(data.leaveTypes || []);
    } catch (error) {
      console.error("Failed to fetch leave types:", error);
      toast.error("Failed to fetch leave types");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ UPDATED: Handle create with policy auto-update
  const handleCreateLeaveType = async () => {
    if (!formData.leaveCode || !formData.leaveName) {
      toast.error("Leave code and name are required");
      return;
    }

    try {
      const response = await fetch("/api/headclerk/leave-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveCode: formData.leaveCode,
          leaveName: formData.leaveName,
          description: formData.description,
          allowHalfDay: formData.allowHalfDay,
          requiresAttachment: formData.requiresAttachment,
          deductsBalance: formData.deductsBalance,
          hasExpiry: formData.hasExpiry,
          expiryInDays: formData.expiryInDays ? parseInt(formData.expiryInDays) : null,
          maxConsecutiveDays: formData.maxConsecutiveDays ? parseInt(formData.maxConsecutiveDays) : null,
          addToPolicy: formData.addToPolicy || false, // ✅ NEW
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create leave type");
      }

      // ✅ Show appropriate success message
      if (data.policyUpdated) {
        toast.success(`Leave type created and ${data.policyMessage}`);
      } else if (formData.addToPolicy) {
        toast.warning(`Leave type created but ${data.policyMessage || 'could not be added to policy'}`);
      } else {
        toast.success("Leave type created successfully");
      }

      setShowCreateDialog(false);
      resetForm();
      await fetchLeaveTypes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create leave type";
      toast.error(errorMessage);
    }
  };

  const openEditDialog = (type: LeaveType) => {
    setEditingLeaveType(type);
    setEditFormData({
      leaveName: type.leaveName,
      description: type.description || "",
      allowHalfDay: type.allowHalfDay,
      requiresAttachment: type.requiresAttachment,
      deductsBalance: type.deductsBalance,
      hasExpiry: type.hasExpiry,
      expiryInDays: type.expiryInDays?.toString() || "",
      maxConsecutiveDays: type.maxConsecutiveDays?.toString() || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeaveType) return;

    if (!editFormData.leaveName.trim()) {
      toast.error("Leave name is required");
      return;
    }

    setEditLoading(true);
    try {
      const response = await fetch(`/api/headclerk/leave-types/${editingLeaveType.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveName: editFormData.leaveName.trim(),
          description: editFormData.description.trim(),
          allowHalfDay: editFormData.allowHalfDay,
          requiresAttachment: editFormData.requiresAttachment,
          deductsBalance: editFormData.deductsBalance,
          hasExpiry: editFormData.hasExpiry,
          expiryInDays: editFormData.expiryInDays ? parseInt(editFormData.expiryInDays) : null,
          maxConsecutiveDays: editFormData.maxConsecutiveDays ? parseInt(editFormData.maxConsecutiveDays) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update leave type");
      }

      // ✅ Show summary of changes if available
      if (data.changes && Object.keys(data.changes).length > 0) {
        const changedFields = Object.keys(data.changes).join(", ");
        toast.success(`Leave type updated: ${changedFields} changed`);
      } else {
        toast.success("Leave type updated successfully");
      }

      setEditDialogOpen(false);
      setEditingLeaveType(null);
      await fetchLeaveTypes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update leave type";
      toast.error(errorMessage);
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (leaveType: LeaveType) => {
    try {
      const response = await fetch(`/api/headclerk/leave-types/${leaveType.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !leaveType.isActive }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update leave type");
      }

      toast.success(`Leave type ${!leaveType.isActive ? "activated" : "deactivated"}`);
      await fetchLeaveTypes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update leave type";
      toast.error(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      leaveCode: "",
      leaveName: "",
      description: "",
      allowHalfDay: false,
      requiresAttachment: false,
      deductsBalance: true,
      hasExpiry: false,
      expiryInDays: "",
      maxConsecutiveDays: "",
      addToPolicy: false, // ✅ Reset to false
    });
  };

  // ========== LEAVE POLICIES FUNCTIONS ==========
  const fetchPolicies = useCallback(async () => {
    try {
      const response = await fetch("/api/headclerk/leave-policies");
      const data = await response.json();
      setPolicies(data.policies || []);
    } catch (error) {
      console.error("Failed to fetch policies:", error);
      toast.error("Failed to fetch policies");
    }
  }, []);

  const getAcademicYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -2; i <= 2; i++) {
      const start = currentYear + i;
      years.push(`${start}-${start + 1}`);
    }
    return years;
  };

  const academicYears = getAcademicYears();

  const handleEditPolicy = (policy: Policy) => {
    setEditingPolicy(policy);
    setPolicyForm({
      academicYear: policy.academicYear,
      applyRule: policy.applyRule,
      leaveAllocations: policy.leaveAllocations as Record<RoleKey, { CL: number; EL: number; ML: number; CO: number; MAT: number; PAT: number; SPL: number }>,
    });
    setShowPolicyDialog(true);
  };

  const handleSavePolicy = async () => {
    if (!policyForm.academicYear) {
      toast.error("Please select an academic year");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/headclerk/leave-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: policyForm.academicYear,
          leaveAllocations: policyForm.leaveAllocations,
          applyRule: policyForm.applyRule,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save policy");
      }

      toast.success("Leave policy saved successfully");
      setShowPolicyDialog(false);
      resetPolicyForm();
      await fetchPolicies();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save policy";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const resetPolicyForm = () => {
    setEditingPolicy(null);
    setPolicyForm({
      academicYear: "",
      applyRule: "immediate",
      leaveAllocations: { ...defaultAllocations },
    });
  };

  // ========== OVERWORK CONFIG FUNCTIONS ==========
  const fetchOverworkConfig = useCallback(async () => {
    try {
      const response = await fetch("/api/headclerk/overwork-config");
      const data = await response.json();
      if (data.config) {
        setOverworkConfig({
          conversionHours: data.config.conversionHours || 5,
          minHoursPerEntry: data.config.minHoursPerEntry || 0.5,
          maxHoursPerDay: data.config.maxHoursPerDay || 24,
          autoConversionEnabled: data.config.autoConversionEnabled !== false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch overwork config:", error);
      toast.error("Failed to fetch overwork configuration");
    }
  }, []);

  const saveOverworkConfig = async () => {
    setSavingConfig(true);
    try {
      const response = await fetch("/api/headclerk/overwork-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overworkConfig),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save configuration");
      }

      toast.success("Overwork configuration saved successfully");
      await fetchOverworkConfig();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save configuration";
      toast.error(errorMessage);
    } finally {
      setSavingConfig(false);
    }
  };

  // ========== VACATION PERIODS FUNCTIONS ==========
  const fetchVacations = useCallback(async () => {
    try {
      const response = await fetch("/api/headclerk/vacation-periods");

      if (!response.ok) {
        let errorMessage = `Failed to fetch vacation periods: ${response.status}`;
        try {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = `Failed to fetch vacation periods: ${response.statusText}`;
        }
        toast.error(errorMessage);
        setVacations([]);
        return;
      }

      const data = await response.json();
      setVacations(data.vacations || []);
    } catch (error) {
      console.error("Failed to fetch vacations:", error);
      toast.error("Failed to fetch vacation periods");
      setVacations([]);
    }
  }, []);

  const calculateTotalDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleEditVacation = (vacation: VacationPeriod) => {
    setEditingVacation(vacation);
    setVacationForm({
      vacationType: vacation.vacationType,
      year: vacation.year,
      startDate: vacation.startDate.split("T")[0],
      endDate: vacation.endDate.split("T")[0],
      paidLeaveQuota: vacation.paidLeaveQuota,
    });
    setShowVacationDialog(true);
  };

  const handleDeactivateVacation = async (id: string) => {
    try {
      const response = await fetch(`/api/headclerk/vacation-periods/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to deactivate vacation period");
      }

      toast.success("Vacation period deactivated");
      await fetchVacations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to deactivate";
      toast.error(errorMessage);
    }
  };

  const handleSaveVacation = async () => {
    if (!vacationForm.vacationType) {
      toast.error("Please select vacation type");
      return;
    }
    if (!vacationForm.year) {
      toast.error("Please select year");
      return;
    }
    if (!vacationForm.startDate || !vacationForm.endDate) {
      toast.error("Please select start and end dates");
      return;
    }

    const totalDays = calculateTotalDays(vacationForm.startDate, vacationForm.endDate);
    if (totalDays !== 40) {
      toast.error("Vacation period must be exactly 40 days");
      return;
    }

    setSavingVacation(true);
    try {
      const response = await fetch("/api/headclerk/vacation-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationType: vacationForm.vacationType,
          year: vacationForm.year,
          startDate: vacationForm.startDate,
          endDate: vacationForm.endDate,
          paidLeaveQuota: vacationForm.paidLeaveQuota,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create vacation period");
      }

      toast.success("Vacation period created successfully");
      setShowVacationDialog(false);
      resetVacationForm();
      await fetchVacations();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create";
      toast.error(errorMessage);
    } finally {
      setSavingVacation(false);
    }
  };

  const resetVacationForm = () => {
    setEditingVacation(null);
    setVacationForm({
      vacationType: "Summer Vacation",
      year: new Date().getFullYear(),
      startDate: "",
      endDate: "",
      paidLeaveQuota: 27,
    });
  };

  // ========== ATTENDANCE FUNCTIONS ==========
  const fetchAttendanceData = useCallback(async () => {
    try {
      const response = await fetch("/api/headclerk/attendance");
      const data = await response.json();
      setDepartmentsList(data.departments || []);
      setStaffUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch attendance data:", error);
    }
  }, []);

  const handleAttendanceRefresh = () => {
    setAttendanceKey((prev) => prev + 1);
    fetchAttendanceData();
  };

  // ========== AUTH CHECK ==========
  const hasRedirected = useRef(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/login");
    }
    if (!isLoading && user && !user.roles?.includes("head_clerk") && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/dashboard");
    }
  }, [user, isLoading, router]);

  // ========== DATA FETCH ==========
  useEffect(() => {
    if (user?.roles?.includes("head_clerk") && !hasFetched.current) {
      hasFetched.current = true;
      const loadAllData = async () => {
        await Promise.all([
          fetchLeaveTypes(),
          fetchPolicies(),
          fetchOverworkConfig(),
          fetchVacations(),
          fetchAttendanceData(),
        ]);
      };
      loadAllData();
    }
  }, [user, fetchLeaveTypes, fetchPolicies, fetchOverworkConfig, fetchVacations, fetchAttendanceData]);

  // Nav items for Head Clerk
  const navItems = [
    { 
      label: "Leave Types", 
      href: "/headclerk/dashboard", 
      icon: <LayoutGrid className="h-4 w-4" />,
      tab: "leave-types"
    },
    { 
      label: "Leave Policies", 
      href: "/headclerk/dashboard", 
      icon: <CalendarDays className="h-4 w-4" />,
      tab: "leave-policies"
    },
    { 
      label: "Year Reset", 
      href: "/headclerk/dashboard", 
      icon: <Clock className="h-4 w-4" />,
      tab: "year-reset"
    },
    { 
      label: "Overwork Config", 
      href: "/headclerk/dashboard", 
      icon: <Award className="h-4 w-4" />,
      tab: "overwork"
    },
    { 
      label: "Vacation Periods", 
      href: "/headclerk/dashboard", 
      icon: <Sun className="h-4 w-4" />,
      tab: "vacation"
    },
    { 
      label: "Attendance", 
      href: "/headclerk/dashboard", 
      icon: <Users className="h-4 w-4" />,
      tab: "attendance"
    },
    { 
      label: "Faculty List", 
      href: "/headclerk/dashboard", 
      icon: <Users className="h-4 w-4" />,
      tab: "faculty"
    },
  ];

  // ========== RENDER ==========
  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user || !user.roles?.includes("head_clerk")) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <RoleNavbar
        role="head_clerk"
        navItems={navItems}
        greeting={`Welcome back, ${user?.name || "Head Clerk"}! 👋`}
        subtitle="Manage leave types, policies, overwork configuration, vacation periods, attendance, and year reset"
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 mt-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="leave-types">Leave Types</TabsTrigger>
          <TabsTrigger value="leave-policies">Leave Policies</TabsTrigger>
          <TabsTrigger value="year-reset">Year Reset</TabsTrigger>
          <TabsTrigger value="overwork">Overwork Config</TabsTrigger>
          <TabsTrigger value="vacation">Vacation Periods</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="faculty">Faculty List</TabsTrigger>
        </TabsList>

        {/* LEAVE TYPES TAB */}
        <TabsContent value="leave-types">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Leave Types</CardTitle>
                <CardDescription>Configure leave categories and their rules</CardDescription>
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Leave Type
              </Button>
            </CardHeader>
            <CardContent>
              {leaveTypes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave types found. Create your first leave type.
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Half Day</TableHead>
                        <TableHead>Attachment</TableHead>
                        <TableHead>Deducts Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveTypes.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell className="font-mono font-medium">{type.leaveCode}</TableCell>
                          <TableCell>{type.leaveName}</TableCell>
                          <TableCell>{type.allowHalfDay ? "✅" : "❌"}</TableCell>
                          <TableCell>{type.requiresAttachment ? "✅" : "❌"}</TableCell>
                          <TableCell>{type.deductsBalance ? "✅" : "❌"}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                type.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {type.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => openEditDialog(type)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleToggleActive(type)}
                              >
                                {type.isActive ? "Deactivate" : "Activate"}
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
        </TabsContent>

        {/* LEAVE POLICIES TAB */}
        <TabsContent value="leave-policies">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Leave Policies</CardTitle>
                <CardDescription>Configure leave quotas per role for each academic year</CardDescription>
              </div>
              <Button onClick={() => setShowPolicyDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Policy
              </Button>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leave policies found. Create your first policy.
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Academic Year</TableHead>
                        <TableHead>Effective From</TableHead>
                        <TableHead>Apply Rule</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => (
                        <TableRow key={policy.academicYear}>
                          <TableCell className="font-medium">{policy.academicYear}</TableCell>
                          <TableCell>
                            {policy.effectiveFrom ? new Date(policy.effectiveFrom).toLocaleDateString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <span className="capitalize">{policy.applyRule}</span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                policy.isActive !== false ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {policy.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => handleEditPolicy(policy)}>
                              <Pencil className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* YEAR RESET TAB */}
        <TabsContent value="year-reset">
          <YearReset />
        </TabsContent>

        {/* OVERWORK CONFIG TAB */}
        <TabsContent value="overwork">
          <Card>
            <CardHeader>
              <CardTitle>Overwork Configuration</CardTitle>
              <CardDescription>
                Configure how overwork hours convert to earned leave days
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="conversionHours">Conversion Rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="conversionHours"
                      type="number"
                      step="0.5"
                      min="1"
                      max="24"
                      value={overworkConfig.conversionHours}
                      onChange={(e) =>
                        setOverworkConfig({
                          ...overworkConfig,
                          conversionHours: parseFloat(e.target.value) || 5,
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-muted-foreground">hours = 1 earned leave day</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Example: 5 hours = 1 day. Staff earn 1 leave day for every X hours of approved overwork.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minHoursPerEntry">Minimum Hours Per Entry</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="minHoursPerEntry"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={overworkConfig.minHoursPerEntry}
                      onChange={(e) =>
                        setOverworkConfig({
                          ...overworkConfig,
                          minHoursPerEntry: parseFloat(e.target.value) || 0.5,
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-muted-foreground">hours minimum</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Staff cannot submit overwork entries below this threshold.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxHoursPerDay">Maximum Hours Per Day</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="maxHoursPerDay"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={overworkConfig.maxHoursPerDay}
                      onChange={(e) =>
                        setOverworkConfig({
                          ...overworkConfig,
                          maxHoursPerDay: parseFloat(e.target.value) || 24,
                        })
                      }
                      className="w-24"
                    />
                    <span className="text-muted-foreground">hours maximum per day</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Staff cannot exceed this number of overwork hours in a single day.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Auto-Conversion</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="autoConversionEnabled"
                      checked={overworkConfig.autoConversionEnabled}
                      onChange={(e) =>
                        setOverworkConfig({
                          ...overworkConfig,
                          autoConversionEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="autoConversionEnabled" className="font-normal cursor-pointer">
                      Automatically convert overwork hours to earned leave when threshold reached
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When disabled, Head Clerk must manually convert overwork hours to leave credits.
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-medium mb-3">Preview</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Current Rule:</span> Every{" "}
                    <span className="text-primary font-medium">{overworkConfig.conversionHours}</span> hours = 1 earned
                    leave day
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Example:</span> Staff with{" "}
                    <span className="font-medium">{overworkConfig.conversionHours * 2}</span> approved hours would earn{" "}
                    <span className="text-primary font-medium">2</span> leave days
                  </p>
                  <div className="mt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Progress to next leave:</span>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "35%" }} />
                      </div>
                      <span>3.5 / {overworkConfig.conversionHours} hours</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={fetchOverworkConfig}>
                  Reset
                </Button>
                <Button onClick={saveOverworkConfig} disabled={savingConfig}>
                  {savingConfig ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VACATION PERIODS TAB */}
        <TabsContent value="vacation">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Vacation Periods</CardTitle>
                <CardDescription>Configure Summer and Winter vacation periods (40 days each)</CardDescription>
              </div>
              <Button onClick={() => setShowVacationDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Vacation Period
              </Button>
            </CardHeader>
            <CardContent>
              {vacations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No vacation periods configured. Create Summer and Winter vacation periods.
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Sun className="h-5 w-5 text-yellow-500" />
                      Summer Vacation
                    </h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Total Days</TableHead>
                            <TableHead>Paid Quota</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vacations
                            .filter((v) => v.vacationType === "Summer Vacation")
                            .map((vacation) => (
                              <TableRow key={vacation.id}>
                                <TableCell className="font-medium">{vacation.year}</TableCell>
                                <TableCell>
                                  {new Date(vacation.startDate).toLocaleDateString()} -{" "}
                                  {new Date(vacation.endDate).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{vacation.totalDays} days</TableCell>
                                <TableCell>{vacation.paidLeaveQuota} days</TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      vacation.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {vacation.isActive ? "Active" : "Inactive"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleEditVacation(vacation)}>
                                      <Pencil className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                    {vacation.isActive && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeactivateVacation(vacation.id)}
                                      >
                                        Deactivate
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          {vacations.filter((v) => v.vacationType === "Summer Vacation").length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                No Summer Vacation periods configured
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Snowflake className="h-5 w-5 text-blue-500" />
                      Winter Vacation
                    </h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Total Days</TableHead>
                            <TableHead>Paid Quota</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vacations
                            .filter((v) => v.vacationType === "Winter Vacation")
                            .map((vacation) => (
                              <TableRow key={vacation.id}>
                                <TableCell className="font-medium">{vacation.year}</TableCell>
                                <TableCell>
                                  {new Date(vacation.startDate).toLocaleDateString()} -{" "}
                                  {new Date(vacation.endDate).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{vacation.totalDays} days</TableCell>
                                <TableCell>{vacation.paidLeaveQuota} days</TableCell>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      vacation.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {vacation.isActive ? "Active" : "Inactive"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleEditVacation(vacation)}>
                                      <Pencil className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                    {vacation.isActive && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeactivateVacation(vacation.id)}
                                      >
                                        Deactivate
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          {vacations.filter((v) => v.vacationType === "Winter Vacation").length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                No Winter Vacation periods configured
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ATTENDANCE TAB */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Management</CardTitle>
              <CardDescription>
                Mark daily attendance for faculty, lab assistants, and office staff
              </CardDescription>
            </CardHeader>
            <CardContent key={attendanceKey}>
              <AttendanceCalendar
                departments={departmentsList}
                staffUsers={staffUsers}
                onRefresh={handleAttendanceRefresh}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* FACULTY LIST TAB */}
        <TabsContent value="faculty">
          <Card>
            <CardHeader>
              <CardTitle>Faculty & Staff Directory</CardTitle>
              <CardDescription>
                View all faculty, lab assistants, and office staff members
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FacultyList departments={departmentsList} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ CREATE LEAVE TYPE DIALOG ============ */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) resetForm();
        setShowCreateDialog(open);
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Leave Type</DialogTitle>
            <DialogDescription>Configure a new leave category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leaveCode">Leave Code *</Label>
              <Input
                id="leaveCode"
                placeholder="e.g., CL, EL, ML"
                value={formData.leaveCode}
                onChange={(e) => setFormData({ ...formData, leaveCode: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leaveName">Leave Name *</Label>
              <Input
                id="leaveName"
                placeholder="e.g., Casual Leave"
                value={formData.leaveName}
                onChange={(e) => setFormData({ ...formData, leaveName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allowHalfDay"
                  checked={formData.allowHalfDay}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowHalfDay: checked === true })}
                />
                <Label htmlFor="allowHalfDay">Allow Half Day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requiresAttachment"
                  checked={formData.requiresAttachment}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresAttachment: checked === true })}
                />
                <Label htmlFor="requiresAttachment">Requires Attachment</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deductsBalance"
                  checked={formData.deductsBalance}
                  onCheckedChange={(checked) => setFormData({ ...formData, deductsBalance: checked === true })}
                />
                <Label htmlFor="deductsBalance">Deducts from Balance</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hasExpiry"
                  checked={formData.hasExpiry}
                  onCheckedChange={(checked) => setFormData({ ...formData, hasExpiry: checked === true })}
                />
                <Label htmlFor="hasExpiry">Has Expiry</Label>
              </div>
            </div>
            {formData.hasExpiry && (
              <div className="space-y-2">
                <Label htmlFor="expiryInDays">Expiry (days)</Label>
                <Input
                  id="expiryInDays"
                  type="number"
                  placeholder="e.g., 180"
                  value={formData.expiryInDays}
                  onChange={(e) => setFormData({ ...formData, expiryInDays: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="maxConsecutiveDays">Max Consecutive Days</Label>
              <Input
                id="maxConsecutiveDays"
                type="number"
                placeholder="Leave blank for no limit"
                value={formData.maxConsecutiveDays}
                onChange={(e) => setFormData({ ...formData, maxConsecutiveDays: e.target.value })}
              />
            </div>

            {/* ✅ NEW: Add to Policy Checkbox */}
            <div className="space-y-2 border-t pt-4 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="addToPolicy"
                  checked={formData.addToPolicy}
                  onCheckedChange={(checked) => setFormData({ ...formData, addToPolicy: checked === true })}
                />
                <Label htmlFor="addToPolicy" className="cursor-pointer">
                  Add to Current Policy
                  <span className="text-xs text-muted-foreground ml-2 block font-normal">
                    (Adds this leave type with 0 quota to all roles)
                  </span>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                If checked, this leave type will be added to all role allocations in the current academic year with 0 days.
                You can later adjust the quota in the Leave Policies tab.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLeaveType}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT LEAVE TYPE DIALOG */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setEditingLeaveType(null);
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Leave Type</DialogTitle>
            <DialogDescription>
              Update the details of {editingLeaveType?.leaveCode} ({editingLeaveType?.leaveName})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editLeaveName">Leave Name *</Label>
              <Input
                id="editLeaveName"
                value={editFormData.leaveName}
                onChange={(e) => setEditFormData({ ...editFormData, leaveName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Input
                id="editDescription"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editAllowHalfDay"
                  checked={editFormData.allowHalfDay}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, allowHalfDay: checked === true })}
                />
                <Label htmlFor="editAllowHalfDay">Allow Half Day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editRequiresAttachment"
                  checked={editFormData.requiresAttachment}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, requiresAttachment: checked === true })}
                />
                <Label htmlFor="editRequiresAttachment">Requires Attachment</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editDeductsBalance"
                  checked={editFormData.deductsBalance}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, deductsBalance: checked === true })}
                />
                <Label htmlFor="editDeductsBalance">Deducts from Balance</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editHasExpiry"
                  checked={editFormData.hasExpiry}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, hasExpiry: checked === true })}
                />
                <Label htmlFor="editHasExpiry">Has Expiry</Label>
              </div>
            </div>

            {editFormData.hasExpiry && (
              <div className="space-y-2">
                <Label htmlFor="editExpiryInDays">Expiry (days)</Label>
                <Input
                  id="editExpiryInDays"
                  type="number"
                  placeholder="e.g., 180"
                  value={editFormData.expiryInDays}
                  onChange={(e) => setEditFormData({ ...editFormData, expiryInDays: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="editMaxConsecutiveDays">Max Consecutive Days</Label>
              <Input
                id="editMaxConsecutiveDays"
                type="number"
                placeholder="Leave blank for no limit"
                value={editFormData.maxConsecutiveDays}
                onChange={(e) => setEditFormData({ ...editFormData, maxConsecutiveDays: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE/EDIT POLICY DIALOG */}
      <Dialog open={showPolicyDialog} onOpenChange={(open) => {
        if (!open) resetPolicyForm();
        setShowPolicyDialog(open);
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Edit Leave Policy" : "Create Leave Policy"}</DialogTitle>
            <DialogDescription>
              Configure leave quotas for each role. Quotas are in days per academic year.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select
                value={policyForm.academicYear}
                onValueChange={(value) => setPolicyForm({ ...policyForm, academicYear: value })}
                disabled={!!editingPolicy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Apply Rule</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="immediate"
                    value="immediate"
                    checked={policyForm.applyRule === "immediate"}
                    onChange={(e) => setPolicyForm({ ...policyForm, applyRule: e.target.value })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="immediate">Apply Immediately</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="next-year"
                    value="next_year"
                    checked={policyForm.applyRule === "next_year"}
                    onChange={(e) => setPolicyForm({ ...policyForm, applyRule: e.target.value })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="next-year">Apply from Next Academic Year</Label>
                </div>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Role</TableHead>
                    <TableHead className="text-center">CL</TableHead>
                    <TableHead className="text-center">EL</TableHead>
                    <TableHead className="text-center">ML</TableHead>
                    <TableHead className="text-center">CO (Max)</TableHead>
                    <TableHead className="text-center">MAT</TableHead>
                    <TableHead className="text-center">PAT</TableHead>
                    <TableHead className="text-center">SPL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.label}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={policyForm.leaveAllocations[role.id]?.CL || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPolicyForm({
                              ...policyForm,
                              leaveAllocations: {
                                ...policyForm.leaveAllocations,
                                [role.id]: {
                                  ...policyForm.leaveAllocations[role.id],
                                  CL: value,
                                },
                              },
                            });
                          }}
                          className="w-16 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={policyForm.leaveAllocations[role.id]?.EL || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPolicyForm({
                              ...policyForm,
                              leaveAllocations: {
                                ...policyForm.leaveAllocations,
                                [role.id]: {
                                  ...policyForm.leaveAllocations[role.id],
                                  EL: value,
                                },
                              },
                            });
                          }}
                          className="w-16 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={policyForm.leaveAllocations[role.id]?.ML || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPolicyForm({
                              ...policyForm,
                              leaveAllocations: {
                                ...policyForm.leaveAllocations,
                                [role.id]: {
                                  ...policyForm.leaveAllocations[role.id],
                                  ML: value,
                                },
                              },
                            });
                          }}
                          className="w-16 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={policyForm.leaveAllocations[role.id]?.CO || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPolicyForm({
                              ...policyForm,
                              leaveAllocations: {
                                ...policyForm.leaveAllocations,
                                [role.id]: {
                                  ...policyForm.leaveAllocations[role.id],
                                  CO: value,
                                },
                              },
                            });
                          }}
                          className="w-16 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={policyForm.leaveAllocations[role.id]?.MAT || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPolicyForm({
                              ...policyForm,
                              leaveAllocations: {
                                ...policyForm.leaveAllocations,
                                [role.id]: {
                                  ...policyForm.leaveAllocations[role.id],
                                  MAT: value,
                                },
                              },
                            });
                          }}
                          className="w-16 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={policyForm.leaveAllocations[role.id]?.PAT || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPolicyForm({
                              ...policyForm,
                              leaveAllocations: {
                                ...policyForm.leaveAllocations,
                                [role.id]: {
                                  ...policyForm.leaveAllocations[role.id],
                                  PAT: value,
                                },
                              },
                            });
                          }}
                          className="w-16 text-center mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={policyForm.leaveAllocations[role.id]?.SPL || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setPolicyForm({
                              ...policyForm,
                              leaveAllocations: {
                                ...policyForm.leaveAllocations,
                                [role.id]: {
                                  ...policyForm.leaveAllocations[role.id],
                                  SPL: value,
                                },
                              },
                            });
                          }}
                          className="w-16 text-center mx-auto"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePolicy} disabled={saving}>
              {saving ? "Saving..." : editingPolicy ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE VACATION PERIOD DIALOG */}
      <Dialog open={showVacationDialog} onOpenChange={(open) => {
        if (!open) resetVacationForm();
        setShowVacationDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVacation ? "Edit Vacation Period" : "Create Vacation Period"}</DialogTitle>
            <DialogDescription>
              Configure 40-day vacation periods with paid leave quota.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vacation Type *</Label>
              <Select
                value={vacationForm.vacationType}
                onValueChange={(value) => {
                  setVacationForm({
                    ...vacationForm,
                    vacationType: value,
                    paidLeaveQuota: value === "Summer Vacation" ? 27 : 21,
                  });
                }}
                disabled={!!editingVacation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vacation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Summer Vacation">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-yellow-500" />
                      Summer Vacation
                    </div>
                  </SelectItem>
                  <SelectItem value="Winter Vacation">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-blue-500" />
                      Winter Vacation
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year *</Label>
              <Select
                value={vacationForm.year.toString()}
                onValueChange={(value) => setVacationForm({ ...vacationForm, year: parseInt(value) })}
                disabled={!!editingVacation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={vacationForm.startDate}
                onChange={(e) => setVacationForm({ ...vacationForm, startDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>End Date *</Label>
              <Input
                type="date"
                value={vacationForm.endDate}
                onChange={(e) => setVacationForm({ ...vacationForm, endDate: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be exactly 40 days from start date
              </p>
            </div>

            <div className="space-y-2">
              <Label>Paid Leave Quota (days) *</Label>
              <Input
                type="number"
                min="0"
                max={vacationForm.vacationType === "Summer Vacation" ? 27 : 21}
                value={vacationForm.paidLeaveQuota}
                onChange={(e) => setVacationForm({ ...vacationForm, paidLeaveQuota: parseInt(e.target.value) || 0 })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Max: {vacationForm.vacationType === "Summer Vacation" ? 27 : 21} days
              </p>
            </div>

            {vacationForm.startDate && vacationForm.endDate && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">Preview</p>
                <p className="text-xs text-muted-foreground">
                  Total days: {calculateTotalDays(vacationForm.startDate, vacationForm.endDate)} days
                  {calculateTotalDays(vacationForm.startDate, vacationForm.endDate) !== 40 && (
                    <span className="text-red-500 block mt-1">⚠️ Must be exactly 40 days</span>
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVacationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVacation} disabled={savingVacation}>
              {savingVacation ? "Saving..." : editingVacation ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HeadClerkDashboardPage() {
  return (
    <ErrorBoundary>
      <HeadClerkDashboardContent />
    </ErrorBoundary>
  );
}