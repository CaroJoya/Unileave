// components/auth/LoginForm.tsx
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
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const { login, error, setError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSuperAdmin, setHasSuperAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

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

  // Clear error when user types
  useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [email, password, error, setError]);

  // Validate email
  const validateEmail = (value: string) => {
    if (!value) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  // Validate password
  const validatePassword = (value: string) => {
    if (!value) {
      setPasswordError("Password is required");
      return false;
    }
    if (value.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleEmailBlur = () => {
    setTouched(prev => ({ ...prev, email: true }));
    if (email) validateEmail(email);
  };

  const handlePasswordBlur = () => {
    setTouched(prev => ({ ...prev, password: true }));
    if (password) validatePassword(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate both fields
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isEmailValid || !isPasswordValid) {
      setTouched({ email: true, password: true });
      return;
    }
    
    setLoading(true);

    try {
      const success = await login(email, password);
      
      if (success) {
        // Wait a moment for Zustand to update
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get the updated state
        const finalState = useAuthStore.getState();
        const finalRoles = finalState.userRoles || [];
        const finalUser = finalState.user;
        
        console.log("🔍 Final user roles:", finalRoles);
        
        if (finalUser?.status === "deleted") {
          toast.error("Account is deactivated. Please restore your account.");
          setLoading(false);
          return;
        }
        
        if (finalRoles.length === 0) {
          console.error("❌ No roles found for user!");
          toast.error("Account has no roles assigned. Please contact admin.");
          setLoading(false);
          return;
        }
        
        // Redirect based on role
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
      } else {
        // Login failed - error is already set in store
        const stateError = useAuthStore.getState().error;
        if (stateError) {
          // Parse the error message for better UX
          if (stateError.includes("user-not-found") || stateError.includes("User not found") || stateError.includes("Account exists in database but not in authentication")) {
            toast.error("Account not found. Please check your email or contact your administrator.");
          } else if (stateError.includes("wrong-password") || stateError.includes("Incorrect password")) {
            toast.error("Incorrect password. Please try again.");
          } else if (stateError.includes("invalid-email")) {
            toast.error("Invalid email address. Please check and try again.");
          } else if (stateError.includes("too-many-requests")) {
            toast.error("Too many failed attempts. Please try again later.");
          } else if (stateError.includes("network-request-failed") || stateError.includes("Network error")) {
            toast.error("Network error. Please check your internet connection.");
          } else if (stateError.includes("user-disabled")) {
            toast.error("Account has been disabled. Please contact administrator.");
          } else if (stateError.includes("invalid-credential")) {
            toast.error("Invalid email or password. Please try again.");
          } else {
            toast.error(stateError);
          }
        } else {
          toast.error("Invalid email or password. Please try again.");
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
          Sign in to your account or register a new college
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
              onBlur={handleEmailBlur}
              required
              autoComplete="email"
              className={emailError && touched.email ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {emailError && touched.email && (
              <div className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{emailError}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={handlePasswordBlur}
                required
                autoComplete="current-password"
                className={passwordError && touched.password ? "border-red-500 focus-visible:ring-red-500 pr-10" : "pr-10"}
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
            {passwordError && touched.password && (
              <div className="flex items-center gap-1 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{passwordError}</span>
              </div>
            )}
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

        {/* ✅ ALWAYS SHOW THE REGISTRATION BUTTON */}
        <SuperAdminRegistration />
        
        {/* Optional info text */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          {hasSuperAdmin 
            ? "Register a new college or sign in to an existing account" 
            : "Be the first to set up your college"}
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Forgot Password?
        </Link>
      </CardFooter>
    </Card>
  );
}