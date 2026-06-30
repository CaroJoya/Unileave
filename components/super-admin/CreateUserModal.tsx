// components/super-admin/CreateUserModal.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  departments: Array<{ id: string; name: string }>;
}

const ROLES = [
  { id: "super_admin", label: "Super Admin" },
  { id: "head_clerk", label: "Head Clerk" },
  { id: "registrar", label: "Registrar" },
  { id: "principal", label: "Principal" },
  { id: "hod", label: "HOD" },
  { id: "faculty", label: "Faculty" },
  { id: "lab_assistant", label: "Lab Assistant" },
  { id: "office_staff", label: "Office Staff" },
];

const INITIAL_FORM_STATE = {
  name: "",
  email: "",
  phoneNumber: "",
  password: "",
  confirmPassword: "",
  departmentId: "",
  roles: [] as string[],
};

export function CreateUserModal({ 
  open, 
  onOpenChange, 
  onSuccess, 
  departments 
}: CreateUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (open) {
      console.log("CreateUserModal - departments available:", departments?.length || 0);
      console.log("CreateUserModal - department data:", departments);
    }
  }, [open, departments]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFormData(INITIAL_FORM_STATE);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
    onOpenChange(newOpen);
  };

  const handleRoleToggle = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!formData.departmentId) {
      toast.error("Please select a department");
      return;
    }

    if (formData.roles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          password: formData.password,
          departmentId: formData.departmentId,
          roles: formData.roles,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      toast.success("User created successfully!");
      setFormData(INITIAL_FORM_STATE);
      setShowPassword(false);
      setShowConfirmPassword(false);
      onSuccess();
      handleOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create user";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const hasDepartments = departments && departments.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new user account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="departmentId">Department *</Label>
            <Select
              value={formData.departmentId || "none"}
              onValueChange={(value) => {
                if (value !== "none") {
                  setFormData({ ...formData, departmentId: value });
                }
              }}
            >
              <SelectTrigger className={!hasDepartments ? "border-amber-500 bg-amber-50" : ""}>
                <SelectValue placeholder={hasDepartments ? "Select department" : "⚠️ No departments available"} />
              </SelectTrigger>
              <SelectContent>
                {hasDepartments ? (
                  departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    ⚠️ No departments found. Please create one first.
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {!hasDepartments && (
              <p className="text-xs text-amber-600">
                ⚠️ No departments available. Go to the <strong>Departments</strong> tab to create one.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Roles *</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={formData.roles.includes(role.id)}
                    onCheckedChange={() => handleRoleToggle(role.id)}
                  />
                  <Label htmlFor={`role-${role.id}`} className="text-sm">
                    {role.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Password Field with Toggle */}
          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Password must be at least 6 characters
            </p>
          </div>

          {/* Confirm Password Field with Toggle */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !hasDepartments}
          >
            {loading ? "Creating..." : "Create User"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}