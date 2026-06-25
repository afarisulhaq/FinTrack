"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Lock, Mail, Zap } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Turnstile, resetTurnstile } from "~/components/auth/turnstile";
import { useAuthStore } from "~/store/useAuthStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";
import { env } from "~/env";

interface FormErrors {
  email?: string;
  password?: string;
  turnstile?: string;
}

export default function LoginPage() {
  const hasHandledQueryLogin = useRef(false);
  const { login, isLoading, error, clearError } = useAuthStore();
  const { config } = useAppConfigStore();
  // Default off. Flip NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true in `.env`
  // (dev only) to show the quick-login buttons below.
  const showDemoLogin = env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  function validate() {
    const errors: FormErrors = {};
    if (!email.trim()) errors.email = "Email wajib diisi";
    if (!password) errors.password = "Password wajib diisi";
    if (turnstileSiteKey && !turnstileToken)
      errors.turnstile = "Selesaikan verifikasi CAPTCHA dulu";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitLogin(
    nextEmail = email,
    nextPassword = password,
    turnstileTokenOverride?: string,
  ) {
    const success = await login(
      nextEmail,
      nextPassword,
      turnstileTokenOverride ?? turnstileToken ?? undefined,
    );
    if (success) {
      const { user, token } = useAuthStore.getState();
      if (!user) return;
      localStorage.setItem(
        "fintrack_auth",
        JSON.stringify({
          state: { user, token, isAuthenticated: true },
          version: 0,
        }),
      );
      const destination = user.role === "admin" ? "/admin" : "/dashboard";
      window.location.href = destination;
    } else {
      if (turnstileSiteKey) resetTurnstile();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    if (!validate()) return;
    await submitLogin();
  }

  useEffect(() => {
    if (hasHandledQueryLogin.current) return;
    const params = new URLSearchParams(window.location.search);
    const queryEmail = params.get("email");
    const queryPassword = params.get("password");
    if (!queryEmail || !queryPassword) return;

    hasHandledQueryLogin.current = true;
    setEmail(queryEmail);
    setPassword(queryPassword);
    void submitLogin(queryEmail, queryPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function quickLogin(nextEmail: string, nextPassword: string) {
    setEmail(nextEmail);
    setPassword(nextPassword);
    setFormErrors({});
    clearError();
    void submitLogin(nextEmail, nextPassword, undefined);
  }

  return (
    <div
      className="border-border bg-bg-surface relative z-50 w-full max-w-md rounded-2xl border p-6 sm:p-8"
      style={{
        boxShadow: "var(--auth-card-shadow)",
        opacity: 1,
        visibility: "visible",
      }}
    >
      <div className="mb-8">
        <h1 className="text-text-primary mb-1.5 text-2xl font-bold">
          Selamat datang kembali 👋
        </h1>
        <p className="text-text-secondary text-sm">
          Masuk ke akun {config.appName} kamu
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        method="post"
        noValidate
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="text-text-secondary text-sm font-medium"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (formErrors.email)
                  setFormErrors((prev) => ({ ...prev, email: undefined }));
              }}
              disabled={isLoading}
              className="border-border bg-bg-base text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-primary/40 h-12 w-full rounded-xl border pr-3 pl-10 text-sm transition outline-none focus:ring-2 disabled:opacity-60"
            />
          </div>
          {formErrors.email && (
            <p className="text-danger text-xs">{formErrors.email}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-text-secondary text-sm font-medium"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-primary text-xs hover:underline"
            >
              Lupa password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="text-text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (formErrors.password)
                  setFormErrors((prev) => ({ ...prev, password: undefined }));
              }}
              disabled={isLoading}
              className="border-border bg-bg-base text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-primary/40 h-12 w-full rounded-xl border pr-11 pl-10 text-sm transition outline-none focus:ring-2 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-text-muted hover:text-text-secondary absolute top-1/2 right-3 -translate-y-1/2"
              aria-label={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {formErrors.password && (
            <p className="text-danger text-xs">{formErrors.password}</p>
          )}
        </div>

        {error && (
          <div className="border-danger/25 bg-danger/10 flex items-center gap-2.5 rounded-xl border px-3.5 py-3">
            <AlertCircle className="text-danger h-4 w-4 shrink-0" />
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {turnstileSiteKey && (
          <div className="space-y-1">
            <Turnstile
              siteKey={turnstileSiteKey}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
            />
            {formErrors.turnstile && (
              <p className="text-danger text-xs">{formErrors.turnstile}</p>
            )}
          </div>
        )}

        <Button
          type="submit"
          className="h-12 w-full"
          size="lg"
          loading={isLoading}
        >
          Masuk
        </Button>
      </form>

      {showDemoLogin && (
        <div className="space-y-3">
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="border-border w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-surface text-text-muted px-3 text-xs">
                atau
              </span>
            </div>
          </div>

          <p className="text-text-muted text-center text-xs">
            <Zap className="text-warning mr-1 mb-0.5 inline h-3 w-3" />
            Coba langsung dengan akun demo
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => quickLogin("admin@fintrack.app", "admin123")}
              className="border-primary/20 bg-primary/10 hover:border-primary/40 hover:bg-primary/15 rounded-xl border px-3.5 py-3 text-left transition"
            >
              <span className="text-text-primary block text-xs font-semibold">
                Login Admin
              </span>
              <span className="text-text-muted mt-0.5 block text-[11px]">
                admin@fintrack.app / admin123
              </span>
            </button>
            <button
              type="button"
              onClick={() => quickLogin("demo@fintrack.app", "demo123")}
              className="border-success/20 bg-success/10 hover:border-success/40 hover:bg-success/15 rounded-xl border px-3.5 py-3 text-left transition"
            >
              <span className="text-text-primary block text-xs font-semibold">
                Login Demo User
              </span>
              <span className="text-text-muted mt-0.5 block text-[11px]">
                demo@fintrack.app / demo123
              </span>
            </button>
          </div>
        </div>
      )}

      <p className="text-text-secondary mt-8 text-center text-sm">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="text-primary font-semibold hover:underline"
        >
          Daftar sekarang
        </Link>
      </p>
    </div>
  );
}
