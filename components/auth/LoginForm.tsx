// components/auth/LoginForm.tsx - COMPLETE FIXED FILE
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { SuperAdminRegistration } from "./SuperAdminRegistration";
import { Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSuperAdmin() {
      try {
        const response = await fetch("/api/auth/check-super-admin");
        const data = await response.json();
        setHasSuperAdmin(data.hasSuperAdmin);
      } catch (error) {
        console.error("Failed to check super admin:", error);
        setHasSuperAdmin(true);
      } finally {
        setChecking(false);
      }
    }
    checkSuperAdmin();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await login(email, password);
      
      if (success) {
        // ✅ Get fresh state after login
        const state = useAuthStore.getState();
        const userRoles = state.userRoles || [];
        const user = state.user;
        
        // ✅ Small delay to ensure state is fully updated
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // ✅ Get state again after delay
        const refreshedState = useAuthStore.getState();
        const finalRoles = refreshedState.userRoles || [];
        const finalUser = refreshedState.user;
        
        console.log("🔍 Final user roles:", finalRoles);
        
        if (finalUser?.status === "deleted") {
          toast.error("Account is deactivated. Please restore your account.");
          setLoading(false);
          return;
        }
        
        // ✅ Check if user has any roles
        if (finalRoles.length === 0) {
          console.error("❌ No roles found for user!");
          toast.error("Account has no roles assigned. Please contact admin.");
          setLoading(false);
          return;
        }
        
        // ✅ Redirect based on role
        if (finalRoles.includes("super_admin")) {
          router.push("/super-admin/dashboard");
        } else if (finalRoles.includes("head_clerk")) {
          router.push("/headclerk/dashboard");
        } else if (finalRoles.includes("principal")) {
          router.push("/principal/dashboard");
        } else if (finalRoles.includes("registrar")) {
          router.push("/registrar/dashboard");
        } else if (finalRoles.includes("hod")) {
          router.push("/hod/dashboard");
        } else {
          router.push("/dashboard");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to UniLeave</CardTitle>
        <CardDescription>
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {hasSuperAdmin === false && <SuperAdminRegistration />}

        {hasSuperAdmin === true && (
          <div className="text-center text-sm text-muted-foreground">
            <p>No self-registration available</p>
            <p className="text-xs mt-1">Contact college admin for access</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Forgot Password?
        </Link>
      </CardFooter>
    </Card>
  );
}