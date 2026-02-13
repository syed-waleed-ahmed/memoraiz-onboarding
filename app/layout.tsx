import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

import { I18nProvider } from "@/lib/i18n";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memoraiz Onboarding Assistant",
  description:
    "Memoraiz corporate onboarding assistant with live canvas profile builder.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = localStorage.getItem("memoraiz-theme");
                  var theme = storedTheme;
                  if (!storedTheme || (storedTheme !== "light" && storedTheme !== "dark")) {
                    theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
                  }
                  document.documentElement.setAttribute("data-theme", theme);

                  var storedLang = localStorage.getItem("memoraiz-language");
                  var lang = storedLang || (navigator.language.split("-")[0] === "it" ? "it" : "en");
                  document.documentElement.lang = lang;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} antialiased flex flex-col min-h-screen lg:h-screen lg:overflow-hidden`}
        suppressHydrationWarning
      >
        <I18nProvider>
          {process.env.NEXT_PUBLIC_VERCEL_ENV === "production" && (
            <>
              <SpeedInsights />
              <Analytics />
            </>
          )}
          <div className="pointer-events-none absolute inset-0 app-grid opacity-60" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="glow-orb absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-400/10 blur-[80px]" />
            <div className="glow-orb absolute -bottom-40 right-1/4 h-[380px] w-[380px] rounded-full bg-sky-400/10 blur-[80px]" />
          </div>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}

