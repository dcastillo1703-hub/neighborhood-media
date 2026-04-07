import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

import "./globals.css";

export const metadata: Metadata = {
  title: "Neighborhood Media OS",
  description: "Premium hospitality-focused marketing operating system for restaurant clients.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/app-icon.png",
    apple: "/app-icon.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Neighborhood Media OS"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: "#f5efe4"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ServiceWorkerRegister />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
