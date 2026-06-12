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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  hodId: string | null;
  hodName: string | null;
  isActive: boolean;
}

interface HODCandidate {
  uid: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
}

export function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hodCandidates, setHodCandidates] = useState<HODCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAssignHODDialog, setShowAssignHODDialog] = useState<string | null>(null);
  const [selectedHODId, setSelectedHODId] = useState("");

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/super-admin/departments");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch departments");
      }

      setDepartments(data.departments || []);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      toast.error("Failed to fetch departments");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHodCandidates = useCallback(async () => {
    try {
      const response = await fetch("/api/super-admin/departments/hod-candidates");
      const data = await response.json();
      setHodCandidates(data.candidates || []);
    } catch (error) {
      console.error("Failed to fetch HOD candidates:", error);
    }
  }, []);

  // ✅ Fixed: Use an async function inside useEffect
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchDepartments(), fetchHodCandidates()]);
    };
    loadData();
  }, [fetchDepartments, fetchHodCandidates]);

  const handleCreateDepartment = async () => {
    if (!deptName.trim()) {
      toast.error("Department name is required");
      return;
    }

    try {
      const response = await fetch("/api/super-admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deptName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create department");
      }

      toast.success("Department created successfully");
      setDeptName("");
      setShowCreateDialog(false);
      await fetchDepartments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create department";
      toast.error(errorMessage);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      const response = await fetch(`/api/super-admin/departments/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete department");
      }

      toast.success("Department deleted successfully");
      await fetchDepartments();
      setShowDeleteConfirm(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete department";
      toast.error(errorMessage);
    }
  };

  const handleAssignHOD = async (departmentId: string) => {
    if (!selectedHODId) {
      toast.error("Please select a HOD");
      return;
    }

    try {
      const response = await fetch(`/api/super-admin/departments/${departmentId}/assign-hod`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hodId: selectedHODId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign HOD");
      }

      toast.success("HOD assigned successfully");
      setShowAssignHODDialog(null);
      setSelectedHODId("");
      await fetchDepartments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to assign HOD";
      toast.error(errorMessage);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Manage departments and HOD assignments</CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>+ New Department</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading departments...</div>
        ) : departments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No departments found. Create your first department.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead>HOD</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      {dept.hodName ? (
                        <span className="text-sm">{dept.hodName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          dept.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {dept.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAssignHODDialog(dept.id);
                            setSelectedHODId(dept.hodId || "");
                          }}
                        >
                          Assign HOD
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setShowDeleteConfirm(dept.id)}
                        >
                          Delete
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

      {/* Create Department Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Department</DialogTitle>
            <DialogDescription>Enter the department name to create a new department.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">Department Name</Label>
              <Input
                id="deptName"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g., Computer Science"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDepartment}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign HOD Dialog */}
      <Dialog open={!!showAssignHODDialog} onOpenChange={() => setShowAssignHODDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign HOD</DialogTitle>
            <DialogDescription>Select a user with HOD role to assign as department head.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hod">Select HOD</Label>
              <Select value={selectedHODId} onValueChange={setSelectedHODId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a HOD" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {hodCandidates.map((candidate) => (
                    <SelectItem key={candidate.uid} value={candidate.uid}>
                      {candidate.name} ({candidate.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignHODDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => showAssignHODDialog && handleAssignHOD(showAssignHODDialog)}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the department
              and all its associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => showDeleteConfirm && handleDeleteDepartment(showDeleteConfirm)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}