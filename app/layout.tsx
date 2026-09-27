import type { Metadata, Viewport } from "next";

import { DM_Mono, Poppins } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${poppins.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
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
