import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { CompanyProvider } from "@/lib/context/CompanyContext";
import { LocaleProvider } from "@/lib/context/LocaleContext";
import { resolveLocale } from "@/lib/i18n/dictionaries";
import { AppHeader } from "@/components/AppHeader";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Knowledge Harvest - Capture Tacit Knowledge",
  description: "AI-powered platform to convert senior employees' know-how into searchable knowledge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  const initialLocale = resolveLocale(cookieLocale);

  return (
    <html lang={initialLocale}>
      <body className={`${inter.className} antialiased`}>
        <LocaleProvider initialLocale={initialLocale}>
          <CompanyProvider>
            <AppHeader />
            <main className="relative z-0 pb-16 sm:pb-20">{children}</main>
          </CompanyProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
