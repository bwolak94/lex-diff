"use client";

import { create } from "zustand";

// S4-3: Zustand store for diff panel state

interface DiffPanelState {
  /** ELI of the "from" (older) version currently selected */
  fromEli: string | null;
  /** ELI of the "to" (newer) version currently selected */
  toEli: string | null;
  /** Path of the unit currently highlighted in both panels */
  focusedUnitPath: string | null;
  setFromEli: (eli: string | null) => void;
  setToEli: (eli: string | null) => void;
  setFocusedUnitPath: (path: string | null) => void;
  reset: () => void;
}

export const useDiffStore = create<DiffPanelState>((set) => ({
  fromEli: null,
  toEli: null,
  focusedUnitPath: null,
  setFromEli: (eli) => set({ fromEli: eli }),
  setToEli: (eli) => set({ toEli: eli }),
  setFocusedUnitPath: (path) => set({ focusedUnitPath: path }),
  reset: () => set({ fromEli: null, toEli: null, focusedUnitPath: null }),
}));
