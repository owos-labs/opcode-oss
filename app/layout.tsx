import type { Metadata, Viewport } from "next";

import localFont from "next/font/local";

import "./globals.css";
import { Providers } from "./providers";

const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  preload: true,
  src: [
    { path: "./fonts/poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-900.woff2", weight: "900", style: "normal" },
  ],
});

const dmMono = localFont({
  variable: "--font-dm-mono",
  display: "swap",
  preload: true,
  src: [
    { path: "./fonts/dm-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-mono-500.woff2", weight: "500", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Opcode",
  description: "Opcode tools",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F0F" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-occurrence-theme="neo"
      className={`${poppins.variable} ${poppins.className} ${dmMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <Providers
          themeProps={{
            attribute: ["class", "data-theme"],
            defaultTheme: "system",
            disableTransitionOnChange: true,
            enableSystem: true,
          }}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
