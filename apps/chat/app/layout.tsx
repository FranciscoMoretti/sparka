import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import { ElectronTitlebarOffset } from "@/components/electron-titlebar-offset";
import { ThemeProvider } from "@/components/theme-provider";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(config.appUrl),
  title: config.appTitle ?? config.appName,
  description: config.appDescription,
  openGraph: {
    siteName: config.appName,
    url: config.appUrl,
    title: config.appTitle ?? config.appName,
    description: config.appDescription,
  },
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
  interactiveWidget: "resizes-content" as const,
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geist.variable} ${geistMono.variable}`}
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-color-script" strategy="beforeInteractive">
          {THEME_COLOR_SCRIPT}
        </Script>
        {process.env.NODE_ENV !== "production" ? (
          <Script
            src="https://unpkg.com/react-scan/dist/auto.global.js"
            strategy="beforeInteractive"
          />
        ) : null}
      </head>
      <body
        className="antialiased"
        style={{ paddingTop: "var(--electron-titlebar-height, 0px)" }}
        suppressHydrationWarning
      >
        <ElectronTitlebarOffset />
        <Script
          src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
          strategy="afterInteractive"
        />
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableSystem
          >
            <Toaster position="top-center" />
            {children}
          </ThemeProvider>
        </NuqsAdapter>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
