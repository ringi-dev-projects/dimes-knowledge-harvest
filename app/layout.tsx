import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";
import { CompanyProvider } from "@/lib/context/CompanyContext";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const navigation = [
  { name: "Home", href: "/" },
  { name: "Seed Topics", href: "/seed" },
  { name: "Interview", href: "/interview" },
  { name: "Dashboard", href: "/dashboard" },
];

export const metadata: Metadata = {
  title: "Knowledge Harvest - Capture Tacit Knowledge",
  description: "AI-powered platform to convert senior employees' know-how into searchable knowledge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <CompanyProvider>
          <nav className="sticky top-0 z-40 border-b border-white/60 bg-white/75 shadow-sm ring-1 ring-slate-900/5 backdrop-blur supports-[backdrop-filter]:bg-white/55">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30">
                  KH
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-slate-900 sm:text-lg">Knowledge Harvest</span>
                  <span className="hidden text-xs text-slate-500 sm:block">
                    Capture and scale expert know-how
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/60 bg-white/80 p-1 text-xs font-medium text-slate-600 backdrop-blur sm:text-sm md:gap-1.5">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className="rounded-full px-4 py-1.5 transition hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
                <Link
                  href="/seed"
                  className="btn-primary hidden sm:inline-flex"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </nav>
          <main className="relative z-0 pb-16 sm:pb-20">{children}</main>
        </CompanyProvider>
      </body>
    </html>
  );
}
