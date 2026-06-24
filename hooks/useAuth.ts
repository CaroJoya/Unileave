// hooks/useAuth.ts - Remove the parameter entirely
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";

// ✅ Remove the parameter if not needed
async function fetchUserData() {
  const response = await fetch(`/api/auth/me`);
  if (!response.ok) throw new Error('Failed to fetch user');
  return response.json();
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { 
    user, 
    isLoading, 
    setUser, 
    logout 
  } = useAuthStore();

  // ✅ Use React Query for user data with caching
  const { data, refetch } = useQuery({
    queryKey: ['user', user?.uid],
    queryFn: fetchUserData,
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    }
  }, [data, setUser]);

  useEffect(() => {
    return () => {
      // Any cleanup code here
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    router.push("/login");
  };

  return { 
    user, 
    isLoading, 
    logout: handleLogout,
    refreshUser: refetch 
  };
}