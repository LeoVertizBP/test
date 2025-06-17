import type { Metadata } from "next";
import { AuthProvider } from "@/services/auth/AuthContext";
import LayoutWrapper from "@/components/layout/LayoutWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Credit Compliance Tool",
  description: "AI-Driven Credit-Card Affiliate Compliance Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&family=Fira+Mono&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased bg-background min-h-screen flex flex-col">
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
