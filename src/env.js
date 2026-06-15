import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    JWT_SECRET: z.string().optional(),
    WHATSAPP_SESSION_DIR: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),
    /**
     * Brand name baked into server-rendered metadata (browser tab, SEO
     * tags, OpenGraph). The runtime in-app brand name is owned by
     * `useAppConfigStore` and can be overridden per-tenant by admins.
     * This env var is the deployment-time default for places the store
     * cannot reach (server-rendered <head>). Defaults to "FinTrack".
     */
    APP_NAME: z.string().min(1).default("FinTrack"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    /**
     * Set to "true" to show the "Login Admin / Demo User" quick-login
     * buttons on the login page. Default is "false" — only flip to
     * "true" in `.env` during development. Leave unset (or "false")
     * in `.env.production` so the login form is the only way in.
     */
    NEXT_PUBLIC_ENABLE_DEMO_LOGIN: z.enum(["true", "false"]).default("false"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    WHATSAPP_SESSION_DIR: process.env.WHATSAPP_SESSION_DIR,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_DEFAULT_CHAT_ID: process.env.TELEGRAM_DEFAULT_CHAT_ID,
    APP_NAME: process.env.APP_NAME,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_DEMO_LOGIN: process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
