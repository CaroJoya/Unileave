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

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // Check for super admin existence on mount
  useEffect(() => {
    async function checkSuperAdmin() {
      try {
        const response = await fetch("/api/auth/check-super-admin");
        const data = await response.json();
        setHasSuperAdmin(data.hasSuperAdmin);
      } catch (error) {
        console.error("Failed to check super admin:", error);
        setHasSuperAdmin(true); // Default to true on error
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
  // Get user roles from the store after login
  const { userRoles } = useAuthStore.getState();
  
  // ✅ ROLE-BASED REDIRECTION
  if (userRoles.includes("super_admin")) {
    router.push("/super-admin/dashboard");
  } else if (userRoles.includes("head_clerk")) {
    router.push("/headclerk/dashboard");
  } else if (userRoles.includes("hod")) {
    router.push("/hod/dashboard");
  } else if (userRoles.includes("registrar")) {
    router.push("/registrar/dashboard");
  } else if (userRoles.includes("principal")) {
    router.push("/principal/dashboard");
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

  // Show loading state while checking
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
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

        {/* Show registration button only if NO super admin exists */}
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