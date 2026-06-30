// store/authStore.ts
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

// Helper to map Firebase error codes to user-friendly messages
function getAuthErrorMessage(error: FirebaseAuthError): string {
  const errorCode = error.code;
  
  if (!errorCode) {
    return error.message || "Authentication failed";
  }

  switch (errorCode) {
    case "auth/user-not-found":
      return "Account not found. Please check your email or register.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/invalid-email":
      return "Invalid email address. Please check and try again.";
    case "auth/invalid-credential":
      return "Invalid email or password. Please try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/user-disabled":
      return "Account has been disabled. Please contact administrator.";
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Sign-in with email and password is not enabled. Please contact administrator.";
    case "auth/requires-recent-login":
      return "Please sign in again to continue with this action.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email but different sign-in credentials.";
    default:
      return error.message || "Authentication failed";
  }
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

      setUser: (user) => {
        console.log("🔑 setUser called with:", user);
        set({ 
          user, 
          userRoles: user?.roles || [],
          isAuthenticated: !!user 
        });
      },
      
      setIsLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      setHydrationComplete: () => {
        console.log("💧 setHydrationComplete called, setting hydrationComplete to true");
        set({ hydrationComplete: true });
      },

      initialize: async () => {
        const state = get();
        console.log("🏁 initialize called, current state:", { 
          hydrationComplete: state.hydrationComplete, 
          user: !!state.user, 
          isLoading: state.isLoading 
        });
        
        if (state.hydrationComplete && state.user) {
          console.log("🔄 Checking session validity on startup...");
          const isValid = await state.checkSession();
          if (!isValid) {
            console.log("🔄 Session invalid, logging out...");
            await state.logout();
          }
        }
        
        set({ isLoading: false });
        console.log("✅ Auth store initialized, isLoading set to false");
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          console.log("1️⃣ Attempting login with email:", email);
          
          // Basic validation
          if (!email || !password) {
            throw new Error("Email and password are required");
          }
          
          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            throw new Error("Please enter a valid email address");
          }
          
          // Validate password length
          if (password.length < 6) {
            throw new Error("Password must be at least 6 characters");
          }
          
          let userCredential;
          try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
          } catch (authError) {
            const error = authError as FirebaseAuthError;
            console.error("Firebase Auth error:", {
              code: error?.code || "unknown",
              message: error?.message || "Authentication failed",
              error: authError
            });
            
            // Check if user exists in RTDB but not in Auth
            if (error.code === "auth/user-not-found") {
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
              throw new Error("Account not found. Please check your email or register.");
            }
            
            // Use the error mapper for all other errors
            throw new Error(getAuthErrorMessage(error));
          }
          
          console.log("2️⃣ Firebase sign-in successful, UID:", userCredential.user.uid);
          
          const idToken = await userCredential.user.getIdToken();
          console.log("3️⃣ Got ID token");
          
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
          
          if (userData.status === "deleted") {
            throw new Error("Account is deactivated. Please restore your account.");
          }
          
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
          localStorage.removeItem("unileave-auth");

          set({
            user: null,
            userRoles: [],
            isAuthenticated: false,
            isLoading: false,
            error: null,
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
          const err = error as FirebaseAuthError;
          const errorMessage = getAuthErrorMessage(err);
          set({ 
            error: errorMessage,
            isLoading: false 
          });
          return false;
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
          const err = error as FirebaseAuthError;
          const errorMessage = err.message || "Invalid or expired reset link";
          set({ 
            error: errorMessage,
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
          const err = error as FirebaseAuthError;
          const errorMessage = getAuthErrorMessage(err) || "Failed to change password";
          set({ 
            error: errorMessage,
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
      onRehydrateStorage: () => (state) => {
        console.log("🔄 Zustand onRehydrateStorage called, state:", state ? { user: !!state.user } : null);
        if (state) {
          state.setHydrationComplete();
          state.initialize();
        }
      },
    }
  )
);