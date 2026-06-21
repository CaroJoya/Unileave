"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Users, Download, UserCheck, UserX } from "lucide-react";

interface FacultyMember {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  status: string;
  isEmployed: boolean;
  dateOfJoining: string;
}

interface Department {
  id: string;
  name: string;
}

interface FacultyListProps {
  departments: Department[];
}

const roleLabels: Record<string, string> = {
  faculty: "Faculty",
  lab_assistant: "Lab Assistant",
  office_staff: "Office Staff",
  hod: "HOD",
  registrar: "Registrar",
  principal: "Principal",
  head_clerk: "Head Clerk",
  super_admin: "Super Admin",
};

const roleColors: Record<string, string> = {
  faculty: "bg-blue-100 text-blue-800",
  lab_assistant: "bg-purple-100 text-purple-800",
  office_staff: "bg-gray-100 text-gray-800",
  hod: "bg-indigo-100 text-indigo-800",
  registrar: "bg-emerald-100 text-emerald-800",
  principal: "bg-amber-100 text-amber-800",
  head_clerk: "bg-orange-100 text-orange-800",
  super_admin: "bg-red-100 text-red-800",
};

export function FacultyList({ departments }: FacultyListProps) {
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (departmentFilter) params.append("departmentId", departmentFilter);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/headclerk/faculty?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch faculty");
      }

      setFaculty(data.faculty || []);
    } catch (error) {
      console.error("Failed to fetch faculty:", error);
      toast.error("Failed to fetch faculty list");
    } finally {
      setLoading(false);
    }
  }, [search, departmentFilter, roleFilter, statusFilter]);

  // ✅ FIXED: Wrap fetchFaculty in an async function to avoid ESLint warning
  useEffect(() => {
    const loadFaculty = async () => {
      await fetchFaculty();
    };
    loadFaculty();
  }, [fetchFaculty]);

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Department", "Roles", "Status", "Date of Joining"];
    const csvRows = [headers];
    
    for (const member of faculty) {
      csvRows.push([
        member.name,
        member.email,
        member.phoneNumber || "",
        member.departmentName,
        member.roles.map(r => roleLabels[r] || r).join(", "),
        member.status === "active" ? "Active" : "Inactive",
        member.dateOfJoining ? new Date(member.dateOfJoining).toLocaleDateString() : "N/A",
      ]);
    }
    
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faculty_list_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Faculty list exported successfully");
  };

  const totalFaculty = faculty.length;
  const activeFaculty = faculty.filter(f => f.status === "active").length;
  const inactiveFaculty = faculty.filter(f => f.status !== "active").length;
  const facultyCount = faculty.filter(f => f.roles.includes("faculty")).length;
  const labAssistantCount = faculty.filter(f => f.roles.includes("lab_assistant")).length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Staff</p>
                <p className="text-2xl font-bold">{totalFaculty}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeFaculty}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-red-600">{inactiveFaculty}</p>
              </div>
              <UserX className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Faculty</p>
              <p className="text-2xl font-bold">{facultyCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Lab Assistants</p>
              <p className="text-2xl font-bold">{labAssistantCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="w-48">
          <Label>Department</Label>
          <Select
            value={departmentFilter || "all"}
            onValueChange={(value) => setDepartmentFilter(value === "all" ? "" : value)}
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

        <div className="w-48">
          <Label>Role</Label>
          <Select
            value={roleFilter || "all"}
            onValueChange={(value) => setRoleFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
              <SelectItem value="lab_assistant">Lab Assistant</SelectItem>
              <SelectItem value="office_staff">Office Staff</SelectItem>
              <SelectItem value="hod">HOD</SelectItem>
              <SelectItem value="registrar">Registrar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Label>Status</Label>
          <Select
            value={statusFilter || "all"}
            onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deleted">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        
        <Button onClick={() => fetchFaculty()} variant="secondary">
          Refresh
        </Button>
      </div>

      {/* Faculty Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading faculty data...
                </TableCell>
              </TableRow>
            ) : faculty.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No faculty members found.
                </TableCell>
              </TableRow>
            ) : (
              faculty.map((member) => (
                <TableRow key={member.uid}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>{member.phoneNumber || "-"}</TableCell>
                  <TableCell>{member.departmentName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.roles.map((role) => (
                        <Badge key={role} className={roleColors[role] || "bg-gray-100"}>
                          {roleLabels[role] || role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        member.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }
                    >
                      {member.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.dateOfJoining
                      ? new Date(member.dateOfJoining).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}