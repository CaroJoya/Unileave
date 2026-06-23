// store/roleStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface RoleState {
  currentRole: string | null;
  setCurrentRole: (role: string) => void;
  clearRole: () => void;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      currentRole: null,
      setCurrentRole: (role) => set({ currentRole: role }),
      clearRole: () => set({ currentRole: null }),
    }),
    {
      name: "unileave-role",
      storage: createJSONStorage(() => localStorage),
    }
  )
);