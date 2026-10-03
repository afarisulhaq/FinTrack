import "react-day-picker/style.css";
import "~/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { env } from "~/env";
import { SwRegister } from "~/components/pwa/sw-register";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Brand name is read from APP_NAME so each deployment can rebrand the
// browser tab and SEO tags without touching source. In-app branding
// (sidebar, headers, login copy) is still owned by useAppConfigStore
// and can be overridden per-tenant at runtime via Pengaturan App.
// The `?? "FinTrack"` fallback guards the SKIP_ENV_VALIDATION path
// (used during Docker build) where env.js bypasses Zod defaults.
const APP_NAME = env.APP_NAME ?? "FinTrack";
const APP_TAGLINE = `${APP_NAME} – Personal Finance`;

export const metadata: Metadata = {
  title: {
    default: APP_TAGLINE,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Track your finances, budgets, investments, and goals in one place.",
  keywords: [
    "finance",
    "budget",
    "investment",
    "personal finance",
    "expense tracker",
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  metadataBase: new URL("https://fintrack.app"),
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://fintrack.app",
    title: APP_TAGLINE,
    description:
      "Track your finances, budgets, investments, and goals in one place.",
    siteName: APP_NAME,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FFD147",
};

const THEME_COOKIE = "fintrack_theme";

function resolveInitialTheme(stored: string | undefined): "dark" | "light" {
  // `dark`/`light` from the cookie is the user's explicit choice and
  // always wins. Anything else (missing/legacy/invalid) falls back to
  // the system preference, defaulting to dark for first-time visitors
  // (matches the rest of FinTrack's visual language).
  if (stored === "dark" || stored === "light") return stored;
  return "dark";
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading cookies during render is supported in Next 15 server
  // components. The cookie is also written by the client-side theme
  // toggle so SSR and the very first paint agree.
  const storedTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const initialTheme = resolveInitialTheme(storedTheme);
  const htmlClass = `${inter.variable}${initialTheme === "dark" ? " dark" : ""}`.trim();
  return (
    <html lang="id" className={htmlClass} suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `
            (function () {
              try {
                var storedTheme = window.localStorage.getItem('fintrack_theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (!storedTheme) {
                  var hasCookie = document.cookie.indexOf('fintrack_theme=') !== -1;
                  if (!hasCookie) {
                    document.documentElement.classList.toggle('dark', prefersDark);
                  }
                }
              } catch (e) {
                document.documentElement.classList.add('dark');
              }

              try {
                var storedConfig = window.localStorage.getItem('fintrack_app_config');
                if (storedConfig) {
                  var parsed = JSON.parse(storedConfig);
                  var cfg = parsed && parsed.state && parsed.state.config;
                  if (cfg && cfg.primaryColor) {
                    var root = document.documentElement;
                    var p = cfg.primaryColor;
                    var a = cfg.accentColor || p;
                    var hex = p.replace('#', '').trim();
                    var yiq = 128;
                    if (hex.length === 6) {
                      var r = parseInt(hex.slice(0, 2), 16);
                      var g = parseInt(hex.slice(2, 4), 16);
                      var b = parseInt(hex.slice(4, 6), 16);
                      yiq = (r * 299 + g * 587 + b * 114) / 1000;
                    }
                    var onP = yiq >= 150 ? '#121417' : '#ffffff';
                    root.style.setProperty('--primary', p);
                    root.style.setProperty('--accent-color', a);
                    root.style.setProperty('--color-primary', p);
                    root.style.setProperty('--on-primary', onP);
                    root.style.setProperty('--primary-hover', 'color-mix(in oklab, ' + p + ' 85%, black)');
                    root.style.setProperty('--primary-deep', 'color-mix(in oklab, ' + p + ' 70%, black)');
                    root.style.setProperty('--primary-glow', 'color-mix(in oklab, ' + p + ' 30%, transparent)');
                    root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, ' + p + ' 0%, ' + a + ' 100%)');
                  }
                }
              } catch (e) {}
            })();
          `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Script id="extension-hydration-cleanup" strategy="beforeInteractive">
          {`
            (function () {
              var extensionAttributes = [
                'bis_skin_checked',
                'bis_register'
              ];

              function isExtensionAttribute(name) {
                return extensionAttributes.indexOf(name) !== -1 || name.indexOf('__processed_') === 0;
              }

              function cleanNode(node) {
                if (!node || !node.attributes) return;
                Array.prototype.slice.call(node.attributes).forEach(function (attr) {
                  if (isExtensionAttribute(attr.name)) node.removeAttribute(attr.name);
                });
              }

              function cleanTree(root) {
                if (!root) return;
                cleanNode(root);
                if (!root.querySelectorAll) return;
                root.querySelectorAll('[bis_skin_checked], [bis_register]').forEach(cleanNode);
              }

              cleanTree(document.documentElement);

              var observer = new MutationObserver(function (records) {
                records.forEach(function (record) {
                  if (record.type === 'attributes') cleanNode(record.target);
                  if (record.type === 'childList') {
                    record.addedNodes.forEach(function (node) {
                      if (node.nodeType === 1) cleanTree(node);
                    });
                  }
                });
              });

              function observe() {
                cleanTree(document.documentElement);
                observer.observe(document.documentElement, {
                  attributes: true,
                  childList: true,
                  subtree: true
                });
                window.setTimeout(function () {
                  cleanTree(document.documentElement);
                  observer.disconnect();
                }, 10000);
              }

              if (document.documentElement) observe();
              else document.addEventListener('DOMContentLoaded', observe, { once: true });
            })();
          `}
        </Script>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
