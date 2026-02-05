import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memoraiz Onboarding Assistant",
  description:
    "Memoraiz corporate onboarding assistant with live canvas profile builder.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
