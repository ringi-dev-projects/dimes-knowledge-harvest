'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/context/LocaleContext';
import { LanguageToggle } from '@/components/LanguageToggle';

type NavKey = 'home' | 'seed' | 'interview' | 'dashboard';

const NAV_LINKS: Array<{ key: NavKey; href: string }> = [
  { key: 'home', href: '/' },
  { key: 'seed', href: '/seed' },
  { key: 'interview', href: '/interview' },
  { key: 'dashboard', href: '/dashboard' },
];

export function AppHeader() {
  const { dictionary } = useLocale();
  const labels = dictionary.common.navigation;
  const brand = dictionary.common.brand;

  return (
    <nav className="sticky top-0 z-40 border-b border-white/60 bg-white/75 shadow-sm ring-1 ring-slate-900/5 backdrop-blur supports-[backdrop-filter]:bg-white/55">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30">
            KH
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-slate-900 sm:text-lg">{brand.name}</span>
            <span className="hidden text-xs text-slate-500 sm:block">{brand.tagline}</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <LanguageToggle />
          <div className="flex items-center gap-1 overflow-x-auto rounded-full border border-white/60 bg-white/80 p-1 text-xs font-medium text-slate-600 backdrop-blur sm:text-sm md:gap-1.5">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-full px-4 py-1.5 transition hover:bg-indigo-50 hover:text-indigo-600"
              >
                {labels[item.key]}
              </Link>
            ))}
          </div>
          <Link href="/seed" className="btn-primary hidden sm:inline-flex">
            {labels.getStarted}
          </Link>
        </div>
      </div>
    </nav>
  );
}
