"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "~/store/useAuthStore";

export function useSessionRedirect() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !token || !role) return;
    router.replace(role === "admin" ? "/admin" : "/dashboard");
  }, [hasHydrated, isAuthenticated, token, role, router]);
}
