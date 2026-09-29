"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "~/store/useAuthStore";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Tracks whether the client has painted at least once. Keeping the
  // server and first-client render byte-identical avoids the React
  // "hydration mismatch" warning we get when the auth slice rehydrates
  // from storage and swaps the loading label ("Memuat sesi..." ->
  // "Mengalihkan ke login...") mid-hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && hasHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [mounted, hasHydrated, isAuthenticated, router]);

  // Always render the same DOM on the server and the very first client
  // render. The actual page only swaps in once persist has rehydrated
  // AND we've committed at least one client-side render.
  if (!mounted || !hasHydrated) {
    return <LoadingScreen label="Memuat sesi..." />;
  }

  if (!isAuthenticated) {
    return <LoadingScreen label="Mengalihkan ke login..." />;
  }

  return <>{children}</>;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
        <p className="text-text-muted text-sm">{label}</p>
      </div>
    </div>
  );
}
