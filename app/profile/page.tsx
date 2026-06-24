// app/profile/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/layout/RoleBadge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  User, 
  Key,
  LogOut,
  Trash2,
  AlertCircle,
  LayoutDashboard
} from "lucide-react";

export default function ProfilePage() {
  const { user, userRoles, isLoading, logout, changePassword, requestAccountDeletion } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Auth check
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    setPasswordLoading(true);
    try {
      const success = await changePassword(currentPassword, newPassword);
      if (success) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        
        // ✅ SMART REDIRECT: Stay on profile page with success state
        toast.success("🔐 Password updated. You can continue using the app.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to change password";
      toast.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }
    
    setDeleteLoading(true);
    try {
      const success = await requestAccountDeletion();
      if (success) {
        toast.success("Account deactivation requested. You have 30 days to restore.");
        setShowDeleteConfirm(false);
        setDeleteConfirmText("");
        
        // ✅ SMART REDIRECT: Logout and go to login page
        setTimeout(() => {
          router.push("/login");
        }, 1000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to deactivate account";
      toast.error(errorMessage);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Function to get the correct dashboard URL based on user roles
  const getDashboardUrl = () => {
    if (userRoles.includes("super_admin")) {
      return "/super-admin/dashboard";
    } else if (userRoles.includes("head_clerk")) {
      return "/headclerk/dashboard";
    } else if (userRoles.includes("hod")) {
      return "/hod/dashboard";
    } else if (userRoles.includes("registrar")) {
      return "/registrar/dashboard";
    } else if (userRoles.includes("principal")) {
      return "/principal/dashboard";
    } else {
      return "/dashboard";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!user) return null;

  const dashboardUrl = getDashboardUrl();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-semibold">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-2">
                  <RoleBadge roles={userRoles} />
                </div>
                <div className="mt-4 w-full space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-3"
                    onClick={() => setActiveTab("profile")}
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-3"
                    onClick={() => setActiveTab("security")}
                  >
                    <Key className="h-4 w-4" />
                    Security
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Deactivate Account
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                  {/* Back to Dashboard Button */}
                  <div className="border-t pt-4 mt-4">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-3"
                      onClick={() => router.push(dashboardUrl)}
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Your personal information and account details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Full Name</Label>
                      <p className="font-medium">{user.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{user.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{user.phoneNumber || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge className={user.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {user.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">College</Label>
                      <p className="font-medium">{user.collegeName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Department</Label>
                      <p className="font-medium">{user.departmentName}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Roles</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="outline" className="capitalize">
                            {role.replace("_", " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Member Since</Label>
                      <p className="font-medium">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Change your password or manage account security
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Password must be at least 6 characters
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={passwordLoading}>
                      {passwordLoading ? "Changing..." : "Change Password"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Deactivate Account</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will deactivate your account. You will have <strong>30 days</strong> to restore it before it&apos;s permanently deleted.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Important:</strong> You will not be able to log in until you restore your account.
              </p>
            </div>
            <div className="space-y-2 mb-4">
              <Label>Type <strong>DELETE</strong> to confirm</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="border-red-200 focus:border-red-500"
              />
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={handleRequestDeletion}
                disabled={deleteLoading || deleteConfirmText !== "DELETE"}
              >
                {deleteLoading ? "Processing..." : "Deactivate Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}