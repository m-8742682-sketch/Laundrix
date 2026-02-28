import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SettingsState = {
  ringEnabled: boolean;
  toggleRing: () => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ringEnabled: true,
      toggleRing: () => set((state) => ({ ringEnabled: !state.ringEnabled })),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);