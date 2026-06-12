import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { User } from "@/types/user";

export function useAuth() {
  const router = useRouter();
  const { user, isLoading, setUser, setIsLoading, logout } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      
      if (firebaseUser) {
        // Fetch user document from Firestore
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUser({ ...userData, uid: firebaseUser.uid });
          
          // Check if user is deleted
          if (userData.status === "deleted") {
            router.push("/restore");
          }
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router, setUser, setIsLoading]);

  const handleLogout = async () => {
    await signOut(auth);
    logout();
    router.push("/login");
  };

  return { user, isLoading, logout: handleLogout };
}