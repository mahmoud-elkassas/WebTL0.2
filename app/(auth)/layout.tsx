import "@/app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { Toast } from "@/components/ui/toast";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WebTL - AI-Powered Webtoon Translation",
  description:
    "Translate webtoons with AI assistance while preserving formatting",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
      <Toaster position="top-right" />
      {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
