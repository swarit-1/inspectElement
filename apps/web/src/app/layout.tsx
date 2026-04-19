import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Red_Hat_Text } from "next/font/google";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const redhat = Red_Hat_Text({
  variable: "--font-redhat",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const TITLE = "IntentGuard — Guard layer for autonomous agents";
const DESCRIPTION =
  "On-chain intents + challenge arbitration for AI agents moving USDC on Base. Sign an intent, let an agent execute, challenge any misstep.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · IntentGuard",
  },
  description: DESCRIPTION,
  applicationName: "IntentGuard",
  authors: [{ name: "IntentGuard" }],
  keywords: [
    "Base",
    "USDC",
    "AI agents",
    "intent",
    "guarded executor",
    "challenge",
    "on-chain",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "IntentGuard",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14181f" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
  ],
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${redhat.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
