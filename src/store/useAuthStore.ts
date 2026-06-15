"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "~/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "owner" | "member";
  status?: "active" | "inactive";
  avatar?: string;
  createdAt: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fallbackUser(email: string): AuthUser {
  const normalizedEmail = email.trim().toLowerCase();
  const isAdmin = normalizedEmail === "admin@fintrack.app";
  const isDemo = normalizedEmail === "demo@fintrack.app";
  return {
    id: isAdmin
      ? "usr-admin-001"
      : isDemo
        ? "usr-demo-001"
        : `usr-${Date.now()}`,
    name: isAdmin
      ? "Admin FinTrack"
      : isDemo
        ? "Andi Pratama"
        : normalizedEmail.split("@")[0],
    email: normalizedEmail,
    role: isAdmin ? "admin" : "owner",
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasHydrated: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
          set({ isLoading: false, error: "Email wajib diisi" });
          return false;
        }
        if (password.length < 6) {
          set({ isLoading: false, error: "Password minimal 6 karakter" });
          return false;
        }

        try {
          const result = await api.login(normalizedEmail, password);
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isLoading: false,
            hasHydrated: true,
            error: null,
          });
          return true;
        } catch (error) {
          // Dev fallback so frontend remains usable if backend server is not running yet.
          await wait(300);
          if (
            (normalizedEmail === "admin@fintrack.app" &&
              password === "admin123") ||
            (normalizedEmail === "demo@fintrack.app" && password === "demo123")
          ) {
            const user = fallbackUser(normalizedEmail);
            set({
              user,
              token: "dev-fallback-token",
              isAuthenticated: true,
              isLoading: false,
              hasHydrated: true,
              error: null,
            });
            return true;
          }
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Login gagal",
          });
          return false;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        const normalizedEmail = email.trim().toLowerCase();
        if (!name.trim()) {
          set({ isLoading: false, error: "Nama wajib diisi" });
          return false;
        }
        if (!normalizedEmail) {
          set({ isLoading: false, error: "Email wajib diisi" });
          return false;
        }
        if (password.length < 6) {
          set({ isLoading: false, error: "Password minimal 6 karakter" });
          return false;
        }

        try {
          const result = await api.register(
            name.trim(),
            normalizedEmail,
            password,
          );
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isLoading: false,
            hasHydrated: true,
            error: null,
          });
          return true;
        } catch (error) {
          await wait(300);
          const user = {
            ...fallbackUser(normalizedEmail),
            name: name.trim(),
            role: "owner" as const,
          };
          set({
            user,
            token: "dev-fallback-token",
            isAuthenticated: true,
            isLoading: false,
            hasHydrated: true,
            error: null,
          });
          return true;
        }
      },

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        }),
      clearError: () => set({ error: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "fintrack_auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
