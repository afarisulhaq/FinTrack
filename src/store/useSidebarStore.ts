"use client";

import { create } from "zustand";

interface SidebarStore {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
  openMobile: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  collapsed: false,
  mobileOpen: false,
  toggleCollapsed: () => set((state) => ({ collapsed: !state.collapsed })),
  toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
  closeMobile: () => set({ mobileOpen: false }),
  openMobile: () => set({ mobileOpen: true }),
}));
