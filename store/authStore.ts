import { create } from "zustand";
import { persist } from "zustand/middleware";
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

interface AuthState {
  user: User | null;
  userRoles: Role[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  setUser: (user: User | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
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
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userRoles: [],
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setUser: (user) => set({ 
        user, 
        userRoles: user?.roles || [],
        isAuthenticated: !!user 
      }),
      
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          console.log("1️⃣ Signing in with Firebase...");
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
          console.log("5️⃣ Session response:", { ok: response.ok, data });
          
          if (!response.ok) {
            if (response.status === 403 && data.error === "Account deactivated") {
              set({ isLoading: false, error: "Account deactivated. Please restore your account." });
              window.location.href = "/restore";
              return false;
            }
            throw new Error(data.error || "Login failed");
          }
          
          // Fetch user data from Realtime Database
          console.log("6️⃣ Fetching user data from RTDB...");
          const userRef = ref(rtdb, `users/${userCredential.user.uid}`);
          const snapshot = await firebaseGet(userRef);
          const userData = snapshot.val();
          console.log("7️⃣ User data from RTDB:", userData);
          
          if (!userData) {
            throw new Error("User data not found");
          }
          
          // Create user object with actual database values
          const user: User = {
            uid: userCredential.user.uid,
            name: userData.name,
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
            roles: user.roles 
          });
          
          set({ 
            user, 
            userRoles: user.roles,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          
          console.log("9️⃣ Login complete, returning true");
          return true;
        } catch (error: unknown) {
          console.error("❌ Login error:", error);
          const err = error as { message?: string };
          set({ 
            error: err.message || "Invalid email or password",
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
          
          // Use firebaseGet instead of get to avoid conflict
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
      partialize: (state) => ({ 
        user: state.user,
        userRoles: state.userRoles,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);