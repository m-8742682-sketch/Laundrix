// stores/settings.store.ts
import { create } from "zustand";

type SettingsState = {
  ringEnabled: boolean;
  toggleRing: () => void;
};

export const useSettings = create<SettingsState>(set => ({
  ringEnabled: true,
  toggleRing: () =>
    set(state => ({ ringEnabled: !state.ringEnabled })),
}));
