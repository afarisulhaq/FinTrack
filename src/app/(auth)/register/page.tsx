"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useAuthStore } from "~/store/useAuthStore";
import { useAppConfigStore } from "~/store/useAppConfigStore";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

function strength(password: string) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (!password) return { level: 0, label: "", color: "#475569" };
  if (score <= 1) return { level: 1, label: "Lemah", color: "#ef4444" };
  if (score === 2) return { level: 2, label: "Cukup", color: "#f59e0b" };
  if (score === 3) return { level: 3, label: "Kuat", color: "#22c55e" };
  return { level: 4, label: "Sangat Kuat", color: "#6366f1" };
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const { config } = useAppConfigStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const passStrength = strength(password);

  function validate() {
    const errors: FormErrors = {};
    if (!name.trim()) errors.name = "Nama lengkap wajib diisi";
    if (!email.trim()) errors.email = "Email wajib diisi";
    if (!password) errors.password = "Password wajib diisi";
    else if (password.length < 6)
      errors.password = "Password minimal 6 karakter";
    if (!confirm) errors.confirm = "Konfirmasi password wajib diisi";
    else if (confirm !== password) errors.confirm = "Password tidak cocok";
    if (!agreed) errors.terms = "Kamu harus menyetujui syarat & ketentuan";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    if (!validate()) return;
    const success = await register(name, email, password);
    if (success) router.push("/dashboard");
  }

  return (
    <div
      className="relative z-50 w-full max-w-md rounded-2xl border border-[#2d3148] bg-[#1a1d27] p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] sm:p-8"
      style={{ opacity: 1, visibility: "visible" }}
    >
      <div className="mb-7">
        <h1 className="text-text-primary mb-1.5 text-2xl font-bold">
          Buat akun baru 🚀
        </h1>
        <p className="text-text-secondary text-sm">
          Mulai perjalanan finansialmu bersama {config.appName}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label="Nama Lengkap"
          error={formErrors.name}
          icon={<User className="h-4 w-4" />}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isLoading}
            autoComplete="name"
            placeholder="Nama lengkap"
            className="login-input"
          />
        </Field>
        <Field
          label="Email"
          error={formErrors.email}
          icon={<Mail className="h-4 w-4" />}
        >
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            autoComplete="email"
            placeholder="nama@email.com"
            className="login-input"
          />
        </Field>
        <div className="space-y-1.5">
          <Field
            label="Password"
            error={formErrors.password}
            icon={<Lock className="h-4 w-4" />}
            right={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="text-text-muted hover:text-text-secondary"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
          >
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
              placeholder="Minimal 6 karakter"
              className="login-input pr-11"
            />
          </Field>
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className="h-1 flex-1 rounded-full"
                    style={{
                      background:
                        passStrength.level >= level
                          ? passStrength.color
                          : "#22263a",
                    }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: passStrength.color }}>
                {passStrength.label}
              </p>
            </div>
          )}
        </div>
        <Field
          label="Konfirmasi Password"
          error={formErrors.confirm}
          icon={<Lock className="h-4 w-4" />}
          right={
            <button
              type="button"
              onClick={() => setShowConfirm((value) => !value)}
              className="text-text-muted hover:text-text-secondary"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          }
        >
          <input
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            disabled={isLoading}
            autoComplete="new-password"
            placeholder="Ulangi password"
            className="login-input pr-11"
          />
          {confirm && confirm === password && (
            <CheckCircle2 className="text-success absolute top-1/2 right-10 h-4 w-4 -translate-y-1/2" />
          )}
        </Field>

        <div className="space-y-1">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#6366f1]"
            />
            <span className="text-text-secondary text-sm leading-snug">
              Saya setuju dengan Syarat & Ketentuan {config.appName}
            </span>
          </label>
          {formErrors.terms && (
            <p className="text-danger ml-7 text-xs">{formErrors.terms}</p>
          )}
        </div>

        {error && (
          <div className="border-danger/25 bg-danger/10 flex items-center gap-2.5 rounded-xl border px-3.5 py-3">
            <AlertCircle className="text-danger h-4 w-4 shrink-0" />
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          className="h-12 w-full"
          size="lg"
          loading={isLoading}
        >
          Daftar Sekarang
        </Button>
      </form>

      <p className="text-text-secondary mt-6 text-center text-sm">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="text-primary font-semibold hover:underline"
        >
          Masuk
        </Link>
      </p>

      <style jsx>{`
        .login-input {
          height: 48px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid #2d3148;
          background: #0f1117;
          padding-left: 40px;
          padding-right: 12px;
          color: #f1f5f9;
          font-size: 14px;
          outline: none;
        }
        .login-input::placeholder {
          color: #475569;
        }
        .login-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.35);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  error,
  icon,
  right,
  children,
}: {
  label: string;
  error?: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-text-secondary text-sm font-medium">{label}</label>
      <div className="relative">
        <div className="text-text-muted absolute top-1/2 left-3 -translate-y-1/2">
          {icon}
        </div>
        {children}
        {right && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2">
            {right}
          </div>
        )}
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
