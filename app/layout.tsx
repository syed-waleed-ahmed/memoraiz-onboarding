import type { Metadata } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

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
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <SpeedInsights />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
