import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { CompanyProvider } from "@/lib/context/CompanyContext";
import { LocaleProvider } from "@/lib/context/LocaleContext";
import { resolveLocale } from "@/lib/i18n/dictionaries";
import { AppHeader } from "@/components/AppHeader";
import { AppFooter } from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "Knowledge Harvest - Capture Tacit Knowledge",
  description: "AI-powered platform to convert senior employees' know-how into searchable knowledge",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  const initialLocale = resolveLocale(cookieLocale);

  return (
    <html lang={initialLocale}>
      <body className="antialiased font-sans">
        <LocaleProvider initialLocale={initialLocale}>
          <CompanyProvider>
            <AppHeader />
            <main className="relative z-0 pb-16 sm:pb-20">{children}</main>
            <AppFooter />
          </CompanyProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
