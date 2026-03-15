import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";

import { cn } from "@acme/ui";
import { ThemeProvider } from "@acme/ui/theme";
import { Toaster } from "@acme/ui/toast";

import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.VERCEL_PROJECT_PRODUCTION_URL ?? "http://localhost:3000",
  ),
  title: "Relio — Your professional network, elevated",
  description:
    "Relio makes networking events smarter and more meaningful. Connect with the right people, remember what matters, and build real relationships.",
  openGraph: {
    title: "Relio — Your professional network, elevated",
    description:
      "Relio makes networking events smarter and more meaningful. Connect with the right people, remember what matters, and build real relationships.",
    url: "https://relio.consol8.com",
    siteName: "Relio",
  },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#030712" }],
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
});

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={cn(
          "min-h-screen antialiased",
          dmSans.variable,
          instrumentSerif.variable,
        )}
      >
        <ThemeProvider>
          <TRPCReactProvider>{props.children}</TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
