import type { AuthUser } from "~/store/useAuthStore";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export function getApiBaseUrl() {
  // Explicit override wins (e.g. self-hosted dev where you want the
  // browser to bypass the Next.js rewrite and hit the backend directly).
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  // Browser: use a same-origin URL. The browser fetches go to
  // `${window.location.origin}/api/...` and Next.js's `rewrites()` in
  // next.config.mjs proxies them to the internal Elysia backend on
  // port 4000. The previous version hard-coded port 4000 here, which
  // is intentionally not published in docker-compose.yml and therefore
  // unreachable from the public internet (`ERR_CONNECTION_REFUSED`).
  if (typeof window !== "undefined") return `${window.location.origin}/api`;
  // SSR / build-time: rewrites only apply to browser traffic, so
  // server-side fetch() calls must reach the backend directly on the
  // container's loopback.
  return "http://localhost:4000/api";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success)
    throw new Error(json.error ?? "API request failed");
  return json.data as T;
}

export const api = {
  login(email: string, password: string, turnstileToken?: string) {
    return request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, turnstileToken }),
    });
  },
  register(
    name: string,
    email: string,
    password: string,
    turnstileToken?: string,
  ) {
    return request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, turnstileToken }),
    });
  },
  me(token: string) {
    return request<AuthUser>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  bootstrap<T>(token: string) {
    return request<T>("/bootstrap", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  get<T>(path: string, token: string) {
    return request<T>(path, { headers: { Authorization: `Bearer ${token}` } });
  },
  post<T>(path: string, token: string, body: unknown) {
    return request<T>(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  },
  put<T>(path: string, token: string, body: unknown) {
    return request<T>(path, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  },
  delete<T>(path: string, token: string) {
    return request<T>(path, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

// ─── Public (no-auth) endpoints ──────────────────────────────────────────
// Used by the /pay/:id/:token page. These do not require an auth header.

/** Public pay-page response: bill context + the requesting participant's slot. */
export interface PublicSplitBill {
  billId: string;
  title: string;
  description: string;
  totalAmount: number;
  currency: string;
  paidBy: string;
  date: string;
  status: string;
  /**
   * Brand name configured by the bill owner in admin Pengaturan App.
   * Returned by the public endpoint so the unauthenticated pay page
   * can render the same brand as the in-app UI. Safe to expose — it's
   * a label, not user data.
   */
  appName: string;
  participant: {
    id: string;
    name: string;
    amount: number;
    paid: boolean;
    paidAt?: string;
  };
  meta: {
    participantCount: number;
    paidCount: number;
  };
  /**
   * Merchant's static QRIS — used by the pay page to render a per-participant
   * dynamic QR. Included in the public response because the participant
   * needs it to pay.
   */
  staticQris?: string;
}

/** Public toggle response from PUT /pay. */
export interface PublicPayToggleResult {
  participantId: string;
  paid: boolean;
  paidAt?: string;
}

async function publicRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success)
    throw new Error(json.error ?? "API request failed");
  return json.data as T;
}

export const publicApi = {
  getSplitBill(billId: string, token: string) {
    return publicRequest<PublicSplitBill>(
      `/public/split-bills/${encodeURIComponent(billId)}/${encodeURIComponent(token)}`,
    );
  },
  togglePaid(billId: string, token: string, paid: boolean) {
    return publicRequest<PublicPayToggleResult>(
      `/public/split-bills/${encodeURIComponent(billId)}/${encodeURIComponent(token)}/pay`,
      { method: "PUT", body: JSON.stringify({ paid }) },
    );
  },
};
