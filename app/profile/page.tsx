// app/profile/page.tsx - COMPLETE FIXED VERSION
"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
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
  LayoutDashboard,
  Building2,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { EnhancedCard } from "@/components/ui/enhanced-card";

export default function ProfilePage() {
  const { user, userRoles, isLoading, logout, changePassword, requestAccountDeletion } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        
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
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : "N/A";

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <User className="h-8 w-8 text-primary" />
            Profile Settings
          </h1>
          <p className="text-muted-foreground mt-1.5 text-base">
            Manage your account settings and preferences
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push(dashboardUrl)}
          className="gap-2"
        >
          <LayoutDashboard className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <EnhancedCard 
            variant="elevated"
            padding="lg"
            className="sticky top-24"
          >
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-28 w-28 mb-4 ring-4 ring-primary/10">
                <AvatarFallback className="text-4xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2">
                <RoleBadge roles={userRoles} />
              </div>
              <div className="mt-1">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {user.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              
              <div className="mt-6 w-full border-t pt-4 space-y-1.5">
                <Button 
                  variant={activeTab === "profile" ? "default" : "ghost"} 
                  className="w-full justify-start gap-3 text-left"
                  onClick={() => setActiveTab("profile")}
                >
                  <User className="h-4 w-4" />
                  Profile
                  {activeTab === "profile" && <CheckCircle className="h-3 w-3 ml-auto text-primary" />}
                </Button>
                <Button 
                  variant={activeTab === "security" ? "default" : "ghost"} 
                  className="w-full justify-start gap-3 text-left"
                  onClick={() => setActiveTab("security")}
                >
                  <Key className="h-4 w-4" />
                  Security
                  {activeTab === "security" && <CheckCircle className="h-3 w-3 ml-auto text-primary" />}
                </Button>
                <div className="border-t pt-2 mt-2">
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
                </div>
              </div>
            </div>
          </EnhancedCard>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsContent value="profile" className="mt-0">
              <EnhancedCard 
                variant="elevated"
                header={
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Profile Information</h3>
                      <p className="text-sm text-muted-foreground">Your personal information and account details</p>
                    </div>
                  </div>
                }
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</Label>
                    <p className="font-medium text-gray-900 mt-1">{user.name}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Email</Label>
                    <p className="font-medium text-gray-900 mt-1 flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {user.email}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Phone</Label>
                    <p className="font-medium text-gray-900 mt-1 flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {user.phoneNumber || "Not set"}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                    <p className="mt-1">
                      <Badge className={user.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {user.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">College</Label>
                    <p className="font-medium text-gray-900 mt-1 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {user.collegeName || "Not assigned"}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Department</Label>
                    <p className="font-medium text-gray-900 mt-1 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {user.departmentName || "Not assigned"}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg md:col-span-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Roles</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="outline" className="capitalize bg-primary/5">
                          {role.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg md:col-span-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Member Since</Label>
                    <p className="font-medium text-gray-900 mt-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {memberSince}
                    </p>
                  </div>
                </div>
              </EnhancedCard>
            </TabsContent>

            <TabsContent value="security" className="mt-0">
              <EnhancedCard 
                variant="elevated"
                header={
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Key className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Security Settings</h3>
                      <p className="text-sm text-muted-foreground">Change your password or manage account security</p>
                    </div>
                  </div>
                }
              >
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password must be at least 6 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={cn(
                          "pr-10",
                          confirmPassword && newPassword !== confirmPassword && "border-red-300 focus:border-red-500"
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500">Passwords do not match</p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                    className="w-full gap-2"
                  >
                    {passwordLoading ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                        Changing Password...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4" />
                        Change Password
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 border-t pt-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-amber-800 font-medium">Security Tips</p>
                        <ul className="text-sm text-amber-700 mt-1 list-disc list-inside space-y-1">
                          <li>Use a strong password with at least 6 characters</li>
                          <li>Don&apos;t share your password with anyone</li>
                          <li>Change your password regularly</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </EnhancedCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Deactivate Account</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This will deactivate your account. You will have <strong>30 days</strong> to restore it before it&apos;s permanently deleted.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>⚠️ Important:</strong> You will not be able to log in until you restore your account.
                </span>
              </p>
            </div>
            <div className="space-y-2 mb-4">
              <Label className="text-sm font-medium">
                Type <strong className="text-red-600">DELETE</strong> to confirm
              </Label>
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

// Helper function for cn
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}