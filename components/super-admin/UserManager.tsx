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
import { toast } from "sonner";
import { CreateUserModal } from "./CreateUserModal";

interface User {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  status: string;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

interface UserManagerProps {
  departments: Department[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function UserManager({ departments, onRefresh, isLoading = false }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);

  // ✅ Debug: Log departments when they change
  useEffect(() => {
    console.log("UserManager - departments received:", departments?.length || 0);
  }, [departments]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);
      if (departmentFilter) params.append("departmentId", departmentFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/super-admin/users?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch users");
      }

      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, departmentFilter, statusFilter]);

  useEffect(() => {
    const loadUsers = async () => {
      await fetchUsers();
    };
    loadUsers();
  }, [fetchUsers]);

  const handleDeleteUser = async (uid: string) => {
    try {
      const response = await fetch(`/api/super-admin/users/${uid}/permanent-delete`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success("User permanently deleted");
      await fetchUsers();
      setShowDeleteConfirm(null);
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete user";
      toast.error(errorMessage);
    }
  };

  const handleRestoreUser = async (uid: string) => {
    try {
      const response = await fetch(`/api/super-admin/users/${uid}/restore`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to restore user");
      }

      toast.success("User restored successfully");
      await fetchUsers();
      setShowRestoreConfirm(null);
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to restore user";
      toast.error(errorMessage);
    }
  };

  const handleSoftDelete = async (uid: string) => {
    try {
      const response = await fetch(`/api/super-admin/users/${uid}/deactivate`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to deactivate user");
      }

      toast.success("User deactivated. They have 30 days to restore.");
      await fetchUsers();
      
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to deactivate user";
      toast.error(errorMessage);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-purple-100 text-purple-800",
      head_clerk: "bg-amber-100 text-amber-800",
      registrar: "bg-emerald-100 text-emerald-800",
      principal: "bg-indigo-100 text-indigo-800",
      hod: "bg-blue-100 text-blue-800",
      faculty: "bg-gray-100 text-gray-800",
      lab_assistant: "bg-gray-100 text-gray-800",
      office_staff: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      head_clerk: "Head Clerk",
      registrar: "Registrar",
      principal: "Principal",
      hod: "HOD",
      faculty: "Faculty",
      lab_assistant: "Lab Assistant",
      office_staff: "Office Staff",
    };
    return labels[role] || role;
  };

  // Helper to convert empty string to "all" for Select value
  const getSelectValue = (value: string) => value === "" ? "all" : value;
  
  // Helper to convert "all" back to empty string for API
  const handleRoleChange = (value: string) => {
    setRoleFilter(value === "all" ? "" : value);
  };
  
  const handleDepartmentChange = (value: string) => {
    setDepartmentFilter(value === "all" ? "" : value);
  };
  
  const handleStatusChange = (value: string) => {
    setStatusFilter(value === "all" ? "" : value);
  };

  // ✅ Show loading state for departments
  const hasDepartments = departments && departments.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button 
          onClick={() => setShowCreateModal(true)}
          disabled={!hasDepartments && !isLoading}
        >
          + New User
        </Button>
      </div>

      {/* Show warning if no departments */}
      {!isLoading && !hasDepartments && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
          <p className="text-sm">
            ⚠️ No departments available. Please go to the <strong>Departments</strong> tab to create one before adding users.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <Label>Search</Label>
          <Input
            placeholder="Name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={getSelectValue(roleFilter)} onValueChange={handleRoleChange}>
            <SelectTrigger>
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="head_clerk">Head Clerk</SelectItem>
              <SelectItem value="registrar">Registrar</SelectItem>
              <SelectItem value="principal">Principal</SelectItem>
              <SelectItem value="hod">HOD</SelectItem>
              <SelectItem value="faculty">Faculty</SelectItem>
              <SelectItem value="lab_assistant">Lab Assistant</SelectItem>
              <SelectItem value="office_staff">Office Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Department</Label>
          <Select value={getSelectValue(departmentFilter)} onValueChange={handleDepartmentChange}>
            <SelectTrigger>
              <SelectValue placeholder={hasDepartments ? "All departments" : "No departments"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {hasDepartments ? (
                departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-departments" disabled>
                  No departments available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={getSelectValue(statusFilter)} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.departmentName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(role)}`}
                        >
                          {getRoleLabel(role)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.status === "active" ? "Active" : "Deleted"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {user.status === "deleted" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowRestoreConfirm(user.uid)}
                        >
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSoftDelete(user.uid)}
                          >
                            Deactivate
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setShowDeleteConfirm(user.uid)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={async () => {
          await fetchUsers();
          setShowCreateModal(false);
          if (onRefresh) {
            onRefresh();
          }
        }}
        departments={departments}
      />

      {/* Confirm Delete Modal */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Permanent Deletion</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the user
              from both Authentication and Database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDeleteUser(showDeleteConfirm)}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Restore Modal */}
      <Dialog open={!!showRestoreConfirm} onOpenChange={() => setShowRestoreConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Account Restoration</DialogTitle>
            <DialogDescription>
              This will restore the user&apos;s account and set their status back to active.
              The user will be able to log in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => showRestoreConfirm && handleRestoreUser(showRestoreConfirm)}
            >
              Restore Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}