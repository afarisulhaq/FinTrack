import "~/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { env } from "~/env";

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
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var storedTheme = window.localStorage.getItem('fintrack_theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var isDark = storedTheme ? storedTheme === 'dark' : prefersDark;
                document.documentElement.classList.toggle('dark', isDark);
              } catch (_) {
                document.documentElement.classList.add('dark');
              }
            })();
          `}
        </Script>
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
      </body>
    </html>
  );
}
