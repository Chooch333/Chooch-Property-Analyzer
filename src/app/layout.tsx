import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indy Property Analyzer",
  description: "Indianapolis residential investment property analysis tool",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
