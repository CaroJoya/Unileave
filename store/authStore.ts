import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "firebase/auth";
import { ref, get as firebaseGet } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase/client";
import { User } from "@/types/user";
import { Role } from "@/types/roles";

// Define Firebase Auth error type
interface FirebaseAuthError {
  code?: string;
  message?: string;
  name?: string;
}

interface AuthState {
  user: User | null;
  userRoles: Role[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hydrationComplete: boolean;
  
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHydrationComplete: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  resetPassword: (oobCode: string, newPassword: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  requestAccountDeletion: () => Promise<boolean>;
  restoreAccount: () => Promise<boolean>;
  getAccountStatus: () => Promise<{ status: string; daysLeft?: number } | null>;
  checkSession: () => Promise<boolean>;
  refreshUserData: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userRoles: [],
      isAuthenticated: false,
      isLoading: true,
      error: null,
      hydrationComplete: false,

      setUser: (user) => set({ 
        user, 
        userRoles: user?.roles || [],
        isAuthenticated: !!user 
      }),
      
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setHydrationComplete: () => set({ hydrationComplete: true }),

      // ✅ NEW: Initialize function - called once on app startup
      initialize: async () => {
        const state = get();
        
        // If hydration is complete and we have a user, check session validity
        if (state.hydrationComplete && state.user) {
          console.log("🔄 Checking session validity on startup...");
          const isValid = await state.checkSession();
          if (!isValid) {
            console.log("🔄 Session invalid, logging out...");
            await state.logout();
          }
        }
        
        // ✅ CRITICAL: Always set loading to false after initialization
        set({ isLoading: false });
        console.log("✅ Auth store initialized, isLoading:", false);
      },

      // store/authStore.ts - Fix the login function
// Replace the login function with this improved version

login: async (email: string, password: string) => {
  set({ isLoading: true, error: null });
  
  try {
    console.log("1️⃣ Attempting login with email:", email);
    
    // Validate inputs
    if (!email || !password) {
      throw new Error("Email and password are required");
    }
    
    // Try to sign in
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    } catch (authError) {
      const error = authError as FirebaseAuthError | null;
      console.error("Firebase Auth error:", {
        code: error?.code || "unknown",
        message: error?.message || "Authentication failed",
        error: authError
      });
      
      // More specific error handling
      const errorCode = error?.code;
      // store/authStore.ts - Fix the login function
if (errorCode === "auth/user-not-found") {
  // Check if user exists in RTDB but not Auth (orphaned account)
  const userRef = ref(rtdb, `users`);
  const snapshot = await firebaseGet(userRef);
  const users = snapshot.val();
  let foundInDB = false;
  for (const [, userData] of Object.entries(users || {})) {
    const data = userData as { email: string };
    if (data.email === email) {
      foundInDB = true;
      console.log("User found in RTDB but not in Auth. Need to recreate Auth user.");
      break;
    }
  }
  
  if (foundInDB) {
    throw new Error("Account exists in database but not in authentication. Please contact admin.");
  }
  throw new Error("User not found. Please check your email.");
}
      if (errorCode === "auth/wrong-password") {
        throw new Error("Incorrect password. Please try again.");
      }
      if (errorCode === "auth/invalid-email") {
        throw new Error("Invalid email address.");
      }
      if (errorCode === "auth/invalid-credential") {
        throw new Error("Invalid credentials. Please check your email and password.");
      }
      if (errorCode === "auth/too-many-requests") {
        throw new Error("Too many failed attempts. Please try again later.");
      }
      if (errorCode === "auth/network-request-failed") {
        throw new Error("Network error. Please check your internet connection.");
      }
      if (errorCode === "auth/user-disabled") {
        throw new Error("Account has been disabled. Please contact admin.");
      }
      throw new Error(error?.message || "Authentication failed");
    }
    
    console.log("2️⃣ Firebase sign-in successful, UID:", userCredential.user.uid);
    
    // Get ID token for session
    const idToken = await userCredential.user.getIdToken();
    console.log("3️⃣ Got ID token");
    
    // Create session cookie
    console.log("4️⃣ Creating session cookie...");
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    
    const data = await response.json();
    console.log("5️⃣ Session response:", { ok: response.ok });
    
    if (!response.ok) {
      throw new Error(data.error || "Failed to create session");
    }
    
    // Fetch user data from Realtime Database
    console.log("6️⃣ Fetching user data from RTDB...");
    const userRef = ref(rtdb, `users/${userCredential.user.uid}`);
    const snapshot = await firebaseGet(userRef);
    const userData = snapshot.val();
    console.log("7️⃣ User data from RTDB:", { 
      uid: userCredential.user.uid,
      hasData: !!userData,
      roles: userData?.roles,
      status: userData?.status
    });
    
    if (!userData) {
      throw new Error("User data not found in database. Please contact admin.");
    }
    
    // Check if account is deleted
    if (userData.status === "deleted") {
      throw new Error("Account is deactivated. Please restore your account.");
    }
    
    // Create user object with actual database values
    const user: User = {
      uid: userCredential.user.uid,
      name: userData.name || "User",
      email: userData.email,
      phoneNumber: userData.phoneNumber || "",
      roles: userData.roles || [],
      departmentId: userData.departmentId || "",
      departmentName: userData.departmentName || "",
      collegeId: userData.collegeId,
      collegeName: userData.collegeName || "",
      status: userData.status || "active",
      isEmployed: userData.isEmployed !== false,
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: userData.updatedAt || new Date().toISOString(),
      deletedAt: userData.deletedAt || null,
    };
    
    console.log("8️⃣ User object created:", { 
      uid: user.uid, 
      collegeId: user.collegeId, 
      roles: user.roles,
      name: user.name
    });
    
    set({ 
      user, 
      userRoles: user.roles,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
    
    // Small delay to ensure session cookie is set before redirect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log("9️⃣ Login complete");
    return true;
    
  } catch (error) {
    console.error("❌ Login error:", error);
    const err = error as { message?: string };
    const errorMessage = err.message || "Invalid email or password";
    set({ 
      error: errorMessage,
      isLoading: false 
    });
    return false;
  }
},
      logout: async () => {
        set({ isLoading: true });
        
        try {
          await fetch("/api/auth/session", { method: "DELETE" });
          await signOut(auth);
        } catch (error) {
          console.error("Logout error:", error);
        } finally {
          set({ 
            user: null, 
            userRoles: [],
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await sendPasswordResetEmail(auth, email);
          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error("Forgot password error:", error);
          set({ isLoading: false });
          return true;
        }
      },

      resetPassword: async (oobCode: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await verifyPasswordResetCode(auth, oobCode);
          await confirmPasswordReset(auth, oobCode, newPassword);
          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error("Reset password error:", error);
          const err = error as { message?: string };
          set({ 
            error: err.message || "Invalid or expired reset link",
            isLoading: false 
          });
          return false;
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const user = auth.currentUser;
          if (!user || !user.email) {
            throw new Error("No user logged in");
          }
          
          const credential = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, newPassword);
          
          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error("Change password error:", error);
          const err = error as { message?: string };
          set({ 
            error: err.message || "Failed to change password",
            isLoading: false 
          });
          return false;
        }
      },

      requestAccountDeletion: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const state = get();
          if (!state.user) {
            throw new Error("No user logged in");
          }
          
          const response = await fetch("/api/auth/request-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || "Failed to delete account");
          }
          
          set({ 
            user: { ...state.user, status: "deleted", deletedAt: data.deletedAt },
            isLoading: false 
          });
          
          return true;
        } catch (error) {
          console.error("Account deletion error:", error);
          const err = error as { message?: string };
          set({ 
            error: err.message || "Failed to delete account",
            isLoading: false 
          });
          return false;
        }
      },

      restoreAccount: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch("/api/auth/restore-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || "Failed to restore account");
          }
          
          const state = get();
          await state.refreshUserData();
          
          set({ isLoading: false });
          return true;
        } catch (error) {
          console.error("Restore account error:", error);
          const err = error as { message?: string };
          set({ 
            error: err.message || "Failed to restore account",
            isLoading: false 
          });
          return false;
        }
      },

      getAccountStatus: async () => {
        try {
          const state = get();
          if (!state.user) return null;
          
          const response = await fetch("/api/auth/account-status");
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || "Failed to get account status");
          }
          
          return { status: data.status, daysLeft: data.daysLeft };
        } catch (error) {
          console.error("Get account status error:", error);
          return null;
        }
      },

      checkSession: async () => {
        try {
          const response = await fetch("/api/auth/me");
          const data = await response.json();
          
          if (!response.ok) {
            const state = get();
            await state.logout();
            return false;
          }
          
          const state = get();
          if (data.user && state.user?.uid === data.user.uid) {
            set({ user: data.user, userRoles: data.user.roles });
          }
          
          return true;
        } catch (error) {
          console.error("Session check error:", error);
          return false;
        }
      },

      refreshUserData: async () => {
        try {
          const state = get();
          if (!state.user) return;
          
          const userRef = ref(rtdb, `users/${state.user.uid}`);
          const snapshot = await firebaseGet(userRef);
          const userData = snapshot.val();
          
          if (userData) {
            const updatedUser: User = {
              ...state.user,
              name: userData.name,
              email: userData.email,
              phoneNumber: userData.phoneNumber || "",
              roles: userData.roles || [],
              departmentId: userData.departmentId || "",
              departmentName: userData.departmentName || "",
              collegeId: userData.collegeId,
              collegeName: userData.collegeName || "",
              status: userData.status || "active",
              deletedAt: userData.deletedAt || null,
              updatedAt: userData.updatedAt || new Date().toISOString(),
            };
            
            set({ 
              user: updatedUser, 
              userRoles: updatedUser.roles 
            });
          }
        } catch (error) {
          console.error("Refresh user data error:", error);
        }
      },
    }),
    {
      name: "unileave-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user,
        userRoles: state.userRoles,
        isAuthenticated: state.isAuthenticated 
      }),
      // ✅ NEW: Handle hydration completion
      onRehydrateStorage: () => (state) => {
        console.log("🔄 Zustand hydration complete");
        if (state) {
          state.setHydrationComplete();
          // Initialize the store (check session, set loading to false)
          state.initialize();
        }
      },
    }
  )
);