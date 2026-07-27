"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
interface CollegeData {
  id: string;
  name: string;
  address: string;
  principalId: string | null;
  principalName: string | null;
}

interface User {
  uid: string;
  name: string;
  email: string;
  roles: string[];
}

export function CollegeProfile() {
  const [college, setCollege] = useState<CollegeData | null>(null);
  const [collegeName, setCollegeName] = useState("");
  const [collegeAddress, setCollegeAddress] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ✅ FIX: Define fetch functions with useCallback BEFORE useEffect
  const fetchCollegeData = useCallback(async () => {
    try {
      const response = await fetch("/api/super-admin/college");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch college");
      }

      setCollege(data.college);
      setCollegeName(data.college?.name || "");
      setCollegeAddress(data.college?.address || "");
      setSelectedPrincipalId(data.college?.principalId || "");
    } catch (error) {
      console.error("Failed to fetch college:", error);
      toast.error("Failed to fetch college data");
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/super-admin/users?limit=100");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch users");
      }

      // Filter users with principal role
      const principals = (data.users || []).filter((user: User) =>
        user.roles?.includes("principal")
      );
      setUsers(principals);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, []);

  // ✅ FIX: Now functions are defined, this useEffect works
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchCollegeData(), fetchUsers()]);
      setLoading(false);
    };
    loadData();
  }, [fetchCollegeData, fetchUsers]);

  const handleUpdateCollege = async () => {
    if (!collegeName.trim()) {
      toast.error("College name is required");
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch("/api/super-admin/college", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: collegeName,
          address: collegeAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update college");
      }

      toast.success("College profile updated successfully");
      fetchCollegeData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update college";
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignPrincipal = async () => {
    if (!selectedPrincipalId) {
      toast.error("Please select a principal");
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch("/api/super-admin/college/assign-principal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ principalId: selectedPrincipalId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign principal");
      }

      toast.success("Principal assigned successfully");
      fetchCollegeData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to assign principal";
      toast.error(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Loading college profile...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>College Profile</CardTitle>
        <CardDescription>Manage your college information and principal assignment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* College Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">College Information</h3>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="collegeName">College Name *</Label>
              <Input
                id="collegeName"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="Enter college name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={collegeAddress}
                onChange={(e) => setCollegeAddress(e.target.value)}
                placeholder="Enter college address"
              />
            </div>
            <Button onClick={handleUpdateCollege} disabled={updating}>
              {updating ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Principal Assignment */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Principal Assignment</h3>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="principal">Select Principal</Label>
              <Select value={selectedPrincipalId} onValueChange={setSelectedPrincipalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a principal" />
                </SelectTrigger>
                <SelectContent>
                  {users.length === 0 ? (
                    <SelectItem value="no-users" disabled>
                      No principals available
                    </SelectItem>
                  ) : (
                    users.map((user) => (
                      <SelectItem key={user.uid} value={user.uid}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {college?.principalName && (
              <div className="text-sm text-muted-foreground">
                Current Principal: {college.principalName}
              </div>
            )}
            <Button onClick={handleAssignPrincipal} disabled={updating || users.length === 0}>
              {updating ? "Assigning..." : "Assign Principal"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}