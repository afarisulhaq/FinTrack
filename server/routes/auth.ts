import bcrypt from "bcryptjs";
import { Elysia, t } from "elysia";
import { z } from "zod";
import { users } from "../data.js";
import { extractToken, signToken, verifyToken } from "../auth.js";
import { canUseDatabase, db as prisma } from "../prisma-client.js";
import { fail, id, ok, publicUser } from "../utils.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  turnstileToken: z.string().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  // Cloudflare Turnstile token. The widget returns a one-time token
  // after the user passes the challenge; we hand it to Cloudflare's
  // siteverify endpoint to confirm it's real. Optional in dev (when
  // TURNSTILE_SECRET_KEY is not set on the server) so local dev
  // doesn't need a Turnstile account.
  turnstileToken: z.string().optional(),
});

/**
 * Verify a Cloudflare Turnstile token against their siteverify API.
 * Returns true when:
 *   - The server has no `TURNSTILE_SECRET_KEY` configured (dev mode,
 *     skip verification entirely), OR
 *   - Cloudflare responds `success: true` for the token.
 * Returns false on any network/HTTP error or a non-success response
 * so the registration is rejected.
 *
 * See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
async function verifyTurnstileToken(
  token: string | undefined,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    // No secret configured = Turnstile disabled (dev / staging).
    console.warn(
      "[auth] TURNSTILE_SECRET_KEY not set; skipping Turnstile verification",
    );
    return true;
  }
  if (!token) return false;

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        // Bound the network call so a slow Cloudflare can't stall the
        // register endpoint indefinitely.
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) {
      console.warn(
        `[auth] Turnstile siteverify HTTP ${response.status}; treating as failed`,
      );
      return false;
    }
    const data = (await response.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch (err) {
    console.warn(
      "[auth] Turnstile siteverify threw; treating as failed:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

function publicPrismaUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

export const authRoutes = new Elysia({ prefix: "/api/auth" })
  .post(
    "/login",
    async ({ body, set }) => {
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return fail("Email/password tidak valid");
      }
      const { email, password, turnstileToken } = parsed.data;
      const normalizedEmail = email.toLowerCase();

      // Verify Cloudflare Turnstile challenge if the server is
      // configured for it. Skipped (returns true) when no secret is
      // set so local dev still works without a Turnstile account.
      const turnstileOk = await verifyTurnstileToken(turnstileToken);
      if (!turnstileOk) {
        set.status = 400;
        return fail("Verifikasi CAPTCHA gagal. Coba lagi.");
      }

      if (await canUseDatabase()) {
        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (!user || !(await bcrypt.compare(password, user.password))) {
          set.status = 401;
          return fail("Email atau password salah");
        }
        if (user.status === "pending") {
          set.status = 403;
          return fail(
            "Akun kamu menunggu persetujuan admin. Coba lagi setelah disetujui.",
          );
        }
        if (user.status !== "active") {
          set.status = 403;
          return fail("Akun tidak aktif");
        }
        const token = signToken({
          sub: user.id,
          email: user.email,
          role: user.role as "admin" | "owner" | "member",
        });
        return ok({ token, user: publicPrismaUser(user) });
      }

      const user = users.find((u) => u.email === normalizedEmail);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        set.status = 401;
        return fail("Email atau password salah");
      }
      if (user.status === "pending") {
        set.status = 403;
        return fail(
          "Akun kamu menunggu persetujuan admin. Coba lagi setelah disetujui.",
        );
      }
      if (user.status !== "active") {
        set.status = 403;
        return fail("Akun tidak aktif");
      }
      const token = signToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      return ok({ token, user: publicUser(user) });
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String({ minLength: 6 }),
        turnstileToken: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/register",
    async ({ body, set }) => {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return fail("Data registrasi tidak valid");
      }
      const { name, email, password, turnstileToken } = parsed.data;
      const normalizedEmail = email.toLowerCase();

      // Verify Cloudflare Turnstile challenge if the server is
      // configured for it. Skipped (returns true) when no secret is
      // set so local dev still works without a Turnstile account.
      const turnstileOk = await verifyTurnstileToken(turnstileToken);
      if (!turnstileOk) {
        set.status = 400;
        return fail("Verifikasi CAPTCHA gagal. Coba lagi.");
      }

      const hashed = await bcrypt.hash(password, 10);

      if (await canUseDatabase()) {
        const exists = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (exists) {
          set.status = 409;
          return fail("Email sudah terdaftar");
        }
        // New accounts are created as `pending` and need an admin to
        // flip them to `active` from /admin/users before the owner can
        // log in and reach the dashboard. The first bootstrap admin
        // (created by the seed with `ADMIN_EMAIL` + `ADMIN_PASSWORD`)
        // is exempt from this gate.
        const user = await prisma.user.create({
          data: {
            name,
            email: normalizedEmail,
            password: hashed,
            role: "owner",
            status: "pending",
          },
        });
        // Don't issue a token — the user can't log in until approved.
        // Return the user with their `pending` status so the client
        // can show the "waiting for approval" message.
        return ok({
          token: null,
          user: publicPrismaUser(user),
          awaitingApproval: true,
        });
      }

      if (users.some((u) => u.email === normalizedEmail)) {
        set.status = 409;
        return fail("Email sudah terdaftar");
      }
      const newUser = {
        id: id("usr"),
        name,
        email: normalizedEmail,
        password: hashed,
        role: "owner" as const,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      return ok({
        token: null,
        user: publicUser(newUser),
        awaitingApproval: true,
      });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2 }),
        email: t.String(),
        password: t.String({ minLength: 6 }),
        turnstileToken: t.Optional(t.String()),
      }),
    },
  )
  .get("/me", async ({ request, set }) => {
    const token = extractToken(
      request.headers.get("authorization") ?? undefined,
    );
    if (!token) {
      set.status = 401;
      return fail("Unauthorized");
    }
    const payload = verifyToken(token);
    if (!payload) {
      set.status = 401;
      return fail("Invalid token");
    }

    if (await canUseDatabase()) {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        set.status = 404;
        return fail("User tidak ditemukan");
      }
      return ok(publicPrismaUser(user));
    }

    const user = users.find((u) => u.id === payload.sub);
    if (!user) {
      set.status = 404;
      return fail("User tidak ditemukan");
    }
    return ok(publicUser(user));
  });
